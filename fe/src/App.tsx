import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import ProtectedRoute from "./auth/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import MainLayout from "./pages/Layouts/MainLayout";
import Users from "./pages/Users";
import CreateRFQ from "./pages/Transaction/CreateRfq";
import DashboardHome from "./pages/DashboardHome"; 
import RfqPage from "./pages/Transaction/RfqPage";
import ManageRfqMarketing from "./pages/Transaction/ManageRfqMarketing";
import MasterActivity from "./pages/MasterActivity";
import ActivityDashboard from "./pages/ActivityDashboard";
import EngineeringActivityDashboard from "./pages/EngineeringActivityDashboard";
import PfsPage from "./pages/Transaction/pfs/PfsPage";
import VendorPriceOuthouse from "./pages/Transaction/VendorPriceOuthouse";
import StandardCostPage from "./pages/Transaction/StandardCostPage";
import StandardCostMaster from "./pages/StandardCostMaster";
import FeasibilityPage from "./pages/Transaction/feasibility/FeasibilityPage";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/main"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="dashboard" replace />} />

            <Route path="dashboard" element={<DashboardHome />} />
            <Route
              path="create-rfq"
              element={
                <ProtectedRoute permissions={["rfq_crud"]}>
                  <CreateRFQ />
                </ProtectedRoute>
              }
            />
            <Route path="rfq-list" element={<RfqPage />} />
            <Route path="rfq-list/:rfqId" element={<RfqPage />} />
            <Route
              path="activity-dashboard"
              element={
                <ProtectedRoute>
                  <ActivityDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="engineering-activity-dashboard"
              element={
                <ProtectedRoute>
                  <EngineeringActivityDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="master-activity"
              element={
                <ProtectedRoute permissions={["rfq_crud"]}>
                  <MasterActivity />
                </ProtectedRoute>
              }
            />
            <Route
              path="manage-rfq"
              element={
                <ProtectedRoute permissions={["rfq_crud"]}>
                  <ManageRfqMarketing />
                </ProtectedRoute>
              }
            />
            <Route
              path="manage-rfq/:rfqId"
              element={
                <ProtectedRoute permissions={["rfq_crud"]}>
                  <ManageRfqMarketing />
                </ProtectedRoute>
              }
            />
            <Route
              path="pfs/:type"
              element={
                <ProtectedRoute roles={["engineering", "admin", "marketing"]}>
                  <PfsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="pfs/:type/:rfqId"
              element={
                <ProtectedRoute roles={["engineering", "admin", "marketing"]}>
                  <PfsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="vendor-price-outhouse"
              element={
                <ProtectedRoute roles={["purchasing", "admin"]}>
                  <VendorPriceOuthouse />
                </ProtectedRoute>
              }
            />
            <Route
              path="standard-cost"
              element={
                <ProtectedRoute roles={["purchasing", "accounting", "admin", "marketing"]}>
                  <StandardCostPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="feasibility/:rfqId"
              element={
                <ProtectedRoute roles={["marketing"]}>
                  <FeasibilityPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="feasibility"
              element={
                <ProtectedRoute roles={["marketing"]}>
                  <FeasibilityPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="standard-cost-master"
              element={
                <ProtectedRoute roles={["accounting", "admin"]}>
                  <StandardCostMaster />
                </ProtectedRoute>
              }
            />
            <Route path="users" element={<Users />} />
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
