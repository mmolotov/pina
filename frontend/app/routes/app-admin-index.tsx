import { Navigate } from "react-router";

export default function AppAdminIndexRoute() {
  return <Navigate replace to="/app/admin/users" />;
}
