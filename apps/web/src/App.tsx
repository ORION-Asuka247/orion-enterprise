import { lazy } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Shell from "./components/Shell";
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Properties = lazy(() => import("./pages/Properties"));
import {useTenant} from "./lib/tenant";
const CustomerAssets = lazy(() => import("./pages/CustomerAssets"));
function AssetRegister(){const {activeTenant}=useTenant();return activeTenant?.isCustomer?<CustomerAssets/>:<Assets/>;}
const Assets = lazy(() => import("./pages/Assets"));
const AssetDetail = lazy(() => import("./pages/AssetDetail"));
const AssetScan = lazy(() => import("./pages/AssetScan"));
const AssetQrResolver = lazy(() => import("./pages/AssetQrResolver"));
const AssetInspection = lazy(() => import("./pages/AssetInspection"));
const Inspections = lazy(() => import("./pages/Inspections"));
const Works = lazy(() => import("./pages/Works"));
const Reports = lazy(() => import("./pages/Reports"));
const ReportDetail = lazy(() => import("./pages/ReportDetail"));
const Regulatory = lazy(() => import("./pages/Regulatory"));
const Intelligence = lazy(() => import("./pages/Intelligence"));
const Portal = lazy(() => import("./pages/Portal"));
const Setup = lazy(() => import("./pages/Setup"));

const router = createBrowserRouter([{
  path: "/",
  element: <Shell />,
  children: [
    { index: true, element: <Dashboard /> },
    { path: "setup", element: <Setup /> },
    { path: "properties", element: <Properties /> },
    { path: "assets", element: <AssetRegister /> },
    { path: "assets/scan", element: <AssetScan /> },
    // Keep specific asset workflow routes ahead of the generic asset detail route.
    { path: "assets/:assetId/inspect/:inspectionId", element: <AssetInspection /> },
    { path: "assets/:assetId/inspect", element: <AssetInspection /> },
    { path: "assets/:assetId", element: <AssetDetail /> },
    { path: "q/:qrToken", element: <AssetQrResolver /> },
    { path: "inspections", element: <Inspections /> },
    { path: "works", element: <Works /> },
    { path: "reports", element: <Reports /> },
    { path: "reports/:reportId", element: <ReportDetail /> },
    { path: "regulatory", element: <Regulatory /> },
    { path: "intelligence", element: <Intelligence /> },
    { path: "portal", element: <Portal /> }
  ]
}], { basename: import.meta.env.BASE_URL });

export default function App() {
  return <RouterProvider router={router} />;
}
