import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Shell from "./components/Shell";
import Dashboard from "./pages/Dashboard";
import Properties from "./pages/Properties";
import Assets from "./pages/Assets";
import AssetDetail from "./pages/AssetDetail";
import AssetScan from "./pages/AssetScan";
import AssetQrResolver from "./pages/AssetQrResolver";
import AssetInspection from "./pages/AssetInspection";
import Inspections from "./pages/Inspections";
import Works from "./pages/Works";
import Reports from "./pages/Reports";
import Regulatory from "./pages/Regulatory";
import Intelligence from "./pages/Intelligence";
import Portal from "./pages/Portal";
import Setup from "./pages/Setup";

const router = createBrowserRouter([{
  path: "/",
  element: <Shell />,
  children: [
    { index: true, element: <Dashboard /> },
    { path: "setup", element: <Setup /> },
    { path: "properties", element: <Properties /> },
    { path: "assets", element: <Assets /> },
    { path: "assets/scan", element: <AssetScan /> },
    { path: "assets/:assetId", element: <AssetDetail /> },
    { path: "assets/:assetId/inspect", element: <AssetInspection /> },
    { path: "assets/:assetId/inspect/:inspectionId", element: <AssetInspection /> },
    { path: "q/:qrToken", element: <AssetQrResolver /> },
    { path: "inspections", element: <Inspections /> },
    { path: "works", element: <Works /> },
    { path: "reports", element: <Reports /> },
    { path: "regulatory", element: <Regulatory /> },
    { path: "intelligence", element: <Intelligence /> },
    { path: "portal", element: <Portal /> }
  ]
}]);

export default function App() {
  return <RouterProvider router={router} />;
}
