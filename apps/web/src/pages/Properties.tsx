import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Page from "../components/Page";
import { useTenant } from "../lib/tenant";
import { loadPropertyHierarchy, type PropertyHierarchy } from "../lib/setup";

export default function Properties() {
  const { activeTenant } = useTenant();
  const [properties, setProperties] = useState<PropertyHierarchy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (!activeTenant) {
      setLoading(false);
      return;
    }

    setLoading(true);
    loadPropertyHierarchy(activeTenant.id)
      .then(setProperties)
      .catch((e) => setError(e?.message ?? "Unable to load properties."))
      .finally(() => setLoading(false));
  }, [activeTenant]);

  return (
    <Page title="Properties" kicker="BUILDING DIGITAL TWIN">
      <div className="page-toolbar">
        <div>
          <p className="muted">Manage the permanent building hierarchy used by assets, inspections, reports and works.</p>
        </div>
        <Link className="button-link" to="/setup">Add property</Link>
      </div>

      {searchParams.get("created") === "1" && (
        <div className="success-banner">Building created successfully.</div>
      )}

      {error && <div className="warning">{error}</div>}
      {loading && <div className="panel">Loading properties…</div>}

      {!loading && properties.length === 0 && (
        <div className="panel empty-state">
          <h2>No properties yet</h2>
          <p>Your company is ready. Create the first building to start the live ORION portfolio.</p>
          <Link className="button-link" to="/setup">Open setup wizard</Link>
        </div>
      )}

      <div className="property-list">
        {properties.map(property => {
          const floors = property.blocks.reduce((n, b) => n + b.floors.length, 0);
          return (
            <article className="panel property-card" key={property.id}>
              <div className="property-heading">
                <div>
                  <div className="eyebrow">{property.reference_code || "PROPERTY"}</div>
                  <h2>{property.name}</h2>
                  <p>
                    {[property.address_line1, property.town_city, property.postcode]
                      .filter(Boolean)
                      .join(", ") || "Address not recorded"}
                  </p>
                </div>
                <div className="property-stats">
                  <span><b>{property.blocks.length}</b> Blocks</span>
                  <span><b>{floors}</b> Floors</span>
                </div>
              </div>

              <div className="block-grid">
                {property.blocks.map(block => (
                  <div className="block-card" key={block.id}>
                    <strong>{block.name}</strong>
                    <div className="floor-chips">
                      {block.floors.map(floor => (
                        <span key={floor.id}>{floor.name}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </Page>
  );
}
