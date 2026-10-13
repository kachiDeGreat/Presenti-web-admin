import React from "react";
import { NavLink, Outlet, useNavigate, Navigate } from "react-router-dom";
import {
  Activity,
  Radio,
  Users,
  Sliders,
  FileSpreadsheet,
  LogOut,
  Wifi,
  MapPin,
  CheckCircle,
  Copy,
} from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import styles from "./AppLayout.module.css";

export const AppLayout: React.FC = () => {
  const { user, church, loading, logout } = useAuth();
  const navigate = useNavigate();

  if (!loading && user && !church) {
    return <Navigate to="/onboarding" replace />;
  }

  const handleLogout = async () => {
    await logout();
    toast.info("Signed out successfully.");
    navigate("/login");
  };

  const copyChurchCode = () => {
    if (church?.churchCode) {
      navigator.clipboard.writeText(church.churchCode);
      toast.success(
        `Copied Organization Code "${church.churchCode}" to clipboard!`,
      );
    }
  };

  const isWifiConfigured = Boolean(
    church?.beaconConfig?.ssidHint &&
    church.beaconConfig.ssidHint.trim() !== "" &&
    church?.beaconConfig?.targetBssid &&
    church.beaconConfig.targetBssid.trim() !== "",
  );

  const isGeoConfigured = Boolean(
    church?.geoFallback &&
    church.geoFallback.radiusMeters > 0 &&
    (church.geoFallback.latitude !== 0 || church.geoFallback.longitude !== 0),
  );

  return (
    <div className={styles.layoutRoot}>
      {/* Sidebar Navigation */}
      <aside className={`${styles.sidebar} no-print`}>
        <div className={styles.brandHeader}>
          <img
            src="/image/logo.png"
            alt="Presenti"
            className={styles.brandLogoImg}
          />
        </div>

        {church && (
          <div className={styles.churchMetaCard}>
            <div className={styles.churchMetaLabel}>Organization Workspace</div>
            <div className={styles.churchMetaName} title={church.churchName}>
              {church.churchName}
            </div>
            <button
              type="button"
              onClick={copyChurchCode}
              className={styles.churchMetaCodeBtn}
              title="Click to copy Organization Code for mobile pairing"
            >
              <span>{church.churchCode}</span>
              <Copy size={11} />
            </button>
          </div>
        )}

        <nav className={styles.navigation}>
          <NavLink
            to="/dashboard"
            className={({ isActive }) =>
              isActive
                ? `${styles.navLink} ${styles.navLinkActive}`
                : styles.navLink
            }
          >
            <Activity size={18} />
            <span>Live Attendance Feed</span>
          </NavLink>

          <NavLink
            to="/settings/beacon"
            className={({ isActive }) =>
              isActive
                ? `${styles.navLink} ${styles.navLinkActive}`
                : styles.navLink
            }
          >
            <Radio size={18} />
            <span>Presence Anchors</span>
            {!church?.beaconConfig?.ssidHint && (
              <span
                className="badge badge-warning"
                style={{
                  fontSize: "0.62rem",
                  marginLeft: "auto",
                  padding: "2px 6px",
                }}
              >
                Setup
              </span>
            )}
          </NavLink>

          <NavLink
            to="/members"
            className={({ isActive }) =>
              isActive
                ? `${styles.navLink} ${styles.navLinkActive}`
                : styles.navLink
            }
          >
            <Users size={18} />
            <span>Organization Registered Users</span>
          </NavLink>

          <NavLink
            to="/setup"
            className={({ isActive }) =>
              isActive
                ? `${styles.navLink} ${styles.navLinkActive}`
                : styles.navLink
            }
          >
            <Sliders size={18} />
            <span>Organization & Policy</span>
          </NavLink>

          <NavLink
            to="/reports"
            className={({ isActive }) =>
              isActive
                ? `${styles.navLink} ${styles.navLinkActive}`
                : styles.navLink
            }
          >
            <FileSpreadsheet size={18} />
            <span>Monthly Audit Matrix</span>
          </NavLink>
        </nav>

        {/* Sidebar Footer with Google Profile */}
        <div className={styles.sidebarFooter}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              overflow: "hidden",
            }}
          >
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt="Avatar"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  objectFit: "cover",
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  backgroundColor: "#2563EB",
                  color: "#FFFFFF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {user?.displayName?.[0] || "A"}
              </div>
            )}
            <div className={styles.adminInfo}>
              <span
                className={styles.adminEmail}
                title={user?.displayName || user?.email || "Admin"}
              >
                {user?.displayName || user?.email}
              </span>
              <span
                className={styles.adminRole}
                style={{ display: "flex", alignItems: "center", gap: 4 }}
              >
                <CheckCircle size={10} color="#10B981" /> Verified Administrator
              </span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className={styles.logoutBtn}
            title="Sign Out"
            aria-label="Sign Out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={styles.mainWrapper}>
        <header className={`${styles.topbar} no-print`}>
          <div className={styles.topbarLeft}>
            <div className={styles.topbarTitle}>
              {church?.branchName ||
                church?.churchName ||
                "Attendance Command Center"}
            </div>
            {/* <div className={`badge badge-success ${styles.topbarStatusPill}`}>
              <span className={styles.liveDot} />
              <span>Real-Time Stream Active</span>
            </div> */}
          </div>

          <div className={styles.topbarRight}>
            {church?.churchCode && (
              <button
                type="button"
                onClick={copyChurchCode}
                className={styles.topbarCodePill}
                title="Click to copy Organization Code for mobile pairing"
              >
                <span className={styles.topbarCodeLabel}>Org Code:</span>
                <code>{church.churchCode}</code>
                <Copy size={12} />
              </button>
            )}

            <div className={styles.hardwareAnchorStatus}>
              <Wifi
                size={14}
                color={isWifiConfigured ? "#059669" : "#D97706"}
              />
              <span>
                Wi-Fi:{" "}
                <strong>
                  {isWifiConfigured
                    ? church?.beaconConfig?.targetBssid
                    : "Unconfigured"}
                </strong>
              </span>
            </div>

            <div className={styles.hardwareAnchorStatus}>
              <MapPin
                size={14}
                color={isGeoConfigured ? "#2563EB" : "#D97706"}
              />
              <span>
                Geofence:{" "}
                <strong>
                  {isGeoConfigured
                    ? `${church?.geoFallback?.radiusMeters}m`
                    : "Unconfigured"}
                </strong>
              </span>
            </div>
          </div>
        </header>

        <main className={styles.contentArea}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
