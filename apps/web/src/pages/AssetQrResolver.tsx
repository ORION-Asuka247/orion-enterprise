import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Page from "../components/Page";
import { resolveQrToken } from "../lib/assets";
import { useTenant } from "../lib/tenant";

export default function AssetQrResolver() {
  const { qrToken } = useParams();
  const { activeTenant, tenants, setActiveTenant } = useTenant();
  const navigate = useNavigate();
  const [error, setError] = useState("");

  useEffect(() => {
    async function resolve() {
      if (!qrToken) {
        setError("QR identity is missing.");
        return;
      }

      try {
        const asset = await resolveQrToken(qrToken);

        if (!asset) {
          setError("This QR code does not match an accessible ORION asset.");
          return;
        }

        if (activeTenant?.id !== asset.company_id) {
          const tenant = tenants.find(t => t.id === asset.company_id);
          if (!tenant) {
            setError("You do not have access to the company that owns this asset.");
            return;
          }
          setActiveTenant(tenant);
        }

        navigate(`/assets/${asset.id}`, { replace: true });
      } catch (e: any) {
        setError(e?.message || "Unable to open this QR asset.");
      }
    }

    resolve();
  }, [qrToken, activeTenant, tenants, setActiveTenant, navigate]);

  return (
    <Page title="Opening asset" kicker="ORION QR">
      {error ? <div className="warning">{error}</div> : <div className="panel">Resolving secure asset identity...</div>}
    </Page>
  );
}
