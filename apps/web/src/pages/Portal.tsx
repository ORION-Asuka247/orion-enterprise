import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { downloadVaultDocument } from "../lib/portal";
import Page from "../components/Page";
import { supabase } from "../lib/supabase";
import { useTenant } from "../lib/tenant";

type Property = { id: string; name: string; reference_code: string | null };
type VaultRow = { id: string; property_id: string | null; category: string | null; filename: string | null; storage_path: string | null; uploaded_at: string | null };
type MessageRow = { id: string; property_id: string | null; sender_id: string | null; message: string | null; created_at: string | null };

export default function Portal() {
  const { activeTenant } = useTenant();
  const [properties, setProperties] = useState<Property[]>([]);
  const [documents, setDocuments] = useState<VaultRow[]>([]);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [issuedReports, setIssuedReports] = useState<{id: string; title: string; document_number: string}[]>([]);
  const [downloading, setDownloading] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    if (!activeTenant || !supabase) {
      setProperties([]); setDocuments([]); setMessages([]); setIssuedReports([]); setPropertyId("");
      setLoading(false);
      return;
    }
    setLoading(true);
    setDocuments([]); setMessages([]); setIssuedReports([]);
    setError("");
    const propertyResult = await supabase
      .from("properties")
      .select("id,name,reference_code")
      .eq("company_id", activeTenant.id)
      .order("name");
    if (propertyResult.error) {
      setError(propertyResult.error.message);
      setLoading(false);
      return;
    }
    const props = (propertyResult.data ?? []) as Property[];
    setProperties(props);
    setPropertyId(previous => props.some(p => p.id === previous) ? previous : props[0]?.id || "");

    const ids = props.map(p => p.id);
    if (ids.length === 0) {
      setDocuments([]);
      setMessages([]);
      setLoading(false);
      return;
    }
    const [docResult, messageResult, reportResult] = await Promise.all([
      supabase.from("document_vault").select("id,property_id,category,filename,storage_path,uploaded_at").in("property_id", ids).order("uploaded_at", { ascending: false }).limit(30),
      supabase.from("portal_messages").select("id,property_id,sender_id,message,created_at").in("property_id", ids).order("created_at", { ascending: false }).limit(30),
      supabase.from("orion_reports").select("id,title,document_number").eq("company_id", activeTenant.id).eq("status", "issued").order("issued_at", {ascending:false}).limit(30)
    ]);
    setIssuedReports(reportResult.data ?? []);
    if (reportResult.error) setError(reportResult.error.message);
    else if (docResult.error) setError(docResult.error.message);
    else if (messageResult.error) setError(messageResult.error.message);
    setDocuments((docResult.data ?? []) as VaultRow[]);
    setMessages((messageResult.data ?? []) as MessageRow[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [activeTenant]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!supabase || !propertyId || !message.trim()) return;
    setSending(true);
    setError("");
    const { data: authData } = await supabase.auth.getUser();
    const user = authData.user;
    if (!user) {
      setError("Authentication required.");
      setSending(false);
      return;
    }
    const { error: insertError } = await supabase.from("portal_messages").insert({
      property_id: propertyId,
      sender_id: user.id,
      message: message.trim()
    });
    if (insertError) setError(insertError.message);
    else {
      setMessage("");
      await load();
    }
    setSending(false);
  }

  async function download(row: VaultRow) {
    if (!activeTenant || !row.storage_path) return;
    setDownloading(row.id); setError("");
    try { await downloadVaultDocument(row.storage_path, row.filename || "ASUKA247-document", activeTenant.id); }
    catch (e: any) { setError(e.message); } finally { setDownloading(""); }
  }

  function propertyName(id: string | null) {
    return properties.find(p => p.id === id)?.name || "Property";
  }

  return (
    <Page title="Client collaboration" kicker="PORTALS">
      {error && <div className="warning">{error}</div>}
      {loading ? <div className="panel">Loading collaboration workspace...</div> : (
        <>
          <div className="inspection-progress panel">
            <div><span>Properties</span><strong>{properties.length}</strong></div>
            <div><span>Shared documents</span><strong>{documents.length}</strong></div>
            <div><span>Messages</span><strong>{messages.length}</strong></div>
          </div>

          {properties.length === 0 ? (
            <section className="panel">
              <h2>Portal ready for commissioning</h2>
              <p>Create the first property before client documents and property-specific collaboration can be enabled.</p>
            </section>
          ) : (
            <div className="grid two">
              <section className="panel">
                <div className="eyebrow">CONTROLLED COMMUNICATION</div>
                <h2>Property messages</h2>
                <form onSubmit={send}>
                  <label className="inspection-field">
                    Property
                    <select value={propertyId} onChange={e => setPropertyId(e.target.value)}>
                      {properties.map(p => <option value={p.id} key={p.id}>{p.name}{p.reference_code ? ` · ${p.reference_code}` : ""}</option>)}
                    </select>
                  </label>
                  <label className="inspection-field">
                    Message
                    <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Record a controlled property message or update." />
                  </label>
                  <button type="submit" disabled={sending || !message.trim()}>{sending ? "Sending..." : "Send message"}</button>
                </form>
                <div className="inspection-question-list">
                  {messages.length === 0 ? <p className="muted">No portal messages have been recorded.</p> : messages.map(row => (
                    <article className="inspection-question" key={row.id}>
                      <div className="eyebrow">{propertyName(row.property_id)}</div>
                      <p>{row.message}</p>
                      <small>{row.created_at ? new Date(row.created_at).toLocaleString() : ""}</small>
                    </article>
                  ))}
                </div>
              </section>

              <section className="panel">
                <div className="eyebrow">DOCUMENT VAULT</div>
                <h2>Issued reports</h2>
                {issuedReports.length === 0 ? <p>No issued reports are available yet.</p> : <ul className="clean">{issuedReports.map(r => <li key={r.id}><Link to={`/reports/${r.id}`}>{r.document_number} · {r.title}</Link></li>)}</ul>}
                <h2>Shared records</h2>
                {documents.length === 0 ? (
                  <p className="muted">No client-facing documents have been placed in the portal vault yet.</p>
                ) : (
                  <ul className="clean">
                    {documents.map(row => (
                      <li key={row.id}>
                        <b>{row.category || "File"}</b>
                        <span><strong>{row.filename || "Document"}</strong><br /><small>{propertyName(row.property_id)}{row.uploaded_at ? ` · ${new Date(row.uploaded_at).toLocaleDateString()}` : ""}</small></span>
                        {row.storage_path && <button type="button" disabled={downloading === row.id} onClick={() => download(row)}>{downloading === row.id ? "Downloading…" : "Download"}</button>}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="muted">Reports appear here after they are issued. Shared files are available only to authorised users.</p>
              </section>
            </div>
          )}
        </>
      )}
    </Page>
  );
}
