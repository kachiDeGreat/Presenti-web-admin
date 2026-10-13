import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Wifi, MapPin, FileSpreadsheet } from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import styles from "./AuthPage.module.css";

export const AuthPage: React.FC = () => {
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);

  const { user, church, loading, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  // Active Session Guard: Auto-redirect if user already has an active authenticated session
  useEffect(() => {
    // Do not interfere while user is actively completing Google popup authentication
    if (isGoogleLoading) return;

    if (!loading && user) {
      if (church) {
        navigate("/dashboard", { replace: true });
      } else {
        navigate("/onboarding", { replace: true });
      }
    }
  }, [user, church, loading, navigate, isGoogleLoading]);
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % 3);
    }, 6500);
    return () => clearInterval(timer);
  }, []);

  const handleGoogleSignIn = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsGoogleLoading(true);

    let isDone = false;
    // 25-second timeout guard
    const timeoutTimer = setTimeout(() => {
      if (!isDone) {
        isDone = true;
        setIsGoogleLoading(false);
        toast.warn("Google sign-in timed out. Please try again.");
      }
    }, 25000);

    try {
      const result = await signInWithGoogle();
      isDone = true;
      clearTimeout(timeoutTimer);

      if (result.churchExists) {
        toast.success(
          "Google authentication verified. Opening attendance dashboard...",
        );
        navigate("/dashboard", { replace: true });
      } else {
        toast.info(
          "Google account verified. Starting step-by-step branch onboarding...",
        );
        navigate("/onboarding", { replace: true });
      }
    } catch (err: unknown) {
      if (isDone) return;
      isDone = true;
      clearTimeout(timeoutTimer);

      console.error("Google sign-in error:", err);
      if (err && typeof err === "object" && "code" in err) {
        const fbErr = err as { code: string; message: string };
        if (fbErr.code === "auth/popup-blocked") {
          toast.warn(
            "The sign-in popup was blocked by your browser. Please allow popups.",
          );
        } else if (fbErr.code === "auth/unauthorized-domain") {
          toast.error(
            "Domain not authorized in Firebase Console > Authentication > Settings > Authorized domains. Please add localhost or 127.0.0.1.",
          );
        } else if (
          fbErr.code === "auth/popup-closed-by-user" ||
          fbErr.code === "auth/cancelled-popup-request"
        ) {
          // Closed by user, quiet reset without cancelled alert
        } else {
          toast.error(fbErr.message || "Google sign-in encountered an issue.");
        }
      } else if (err instanceof Error) {
        toast.error(err.message);
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  if (loading) {
    return (
      <div
        className={styles.splitLayout}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          backgroundColor: "#F8FAFC",
        }}
      >
        <div
          style={{ color: "#64748B", fontSize: "0.925rem", fontWeight: 500 }}
        >
          Checking active session...
        </div>
      </div>
    );
  }

  return (
    <div className={styles.splitLayout}>
      {/* =====================================================================
          LEFT PANE: CLEAN GOOGLE LOGIN ONLY
          ===================================================================== */}
      <div className={styles.formPane}>
        {/* Brand Header */}
        <div className={styles.brandHeader}>
          <img
            src="/image/app-icon.png"
            alt="Presenti"
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              objectFit: "cover",
              boxShadow: "0 4px 12px rgba(15, 23, 42, 0.15)",
            }}
          />
          <span className={styles.brandName}>Presenti</span>
        </div>

        {/* Form Body */}
        <div className={styles.formContent}>
          <div className={styles.titleBlock}>
            <h1>Log in to your Account</h1>
            <p>
              Welcome! Continue with your verified Google account to manage your
              organization presence and attendance rosters.
            </p>
          </div>

          {/* Primary Google Sign-In Action */}
          <div>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isGoogleLoading}
              className={styles.googleBtn}
            >
              <svg className={styles.googleIcon} viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>
                {isGoogleLoading
                  ? "Connecting to Google..."
                  : "Continue with Google"}
              </span>
            </button>
          </div>

          {/* Verification & Architecture Card */}
          {/* <div className={styles.trustCard}>
            <div className={styles.trustHeader}>
              <CheckCircle2 size={16} color="#059669" />
              <span>Verified Administrative Authentication</span>
            </div>
            <div className={styles.trustItems}>
              <div className={styles.trustItem}>
                <span className={styles.trustDot} />
                <span>
                  Strict Google OAuth verification eliminates proxy clock-ins
                  and fake registrations.
                </span>
              </div>
              <div className={styles.trustItem}>
                <span className={styles.trustDot} />
                <span>
                  New leaders transition straight into the Step-by-Step
                  Organization Onboarding Wizard.
                </span>
              </div>
              <div className={styles.trustItem}>
                <span className={styles.trustDot} />
                <span>
                  Existing administrators enter their real-time attendance
                  dashboard instantly.
                </span>
              </div>
            </div>
          </div> */}
        </div>

        {/* Footer */}
        <div className={styles.footerNote}>
          Presenti • Proof of Presence, Made Simple
        </div>
      </div>

      {/* =====================================================================
          RIGHT PANE: BLUE SLIDING CAROUSEL
          ===================================================================== */}
      <div className={styles.showcasePane}>
        <div className={styles.showcaseTop}>
          {/* <span className={styles.badgePill}>Official Portal</span> */}
        </div>

        {/* Sliding Carousel Track */}
        <div className={styles.carouselViewport}>
          <div
            className={styles.carouselTrack}
            style={{ transform: `translateX(-${activeSlide * 33.333333}%)` }}
          >
            {/* SLIDE 0: Real-Time Attendance Feed */}
            <div className={styles.carouselSlide}>
              <div className={styles.mockupCard}>
                <div className={styles.mockupHeader}>
                  <span className={styles.dotRed} />
                  <span className={styles.dotYellow} />
                  <span className={styles.dotGreen} />
                  <span className={styles.mockupTitle}>
                    Live Clock-In Stream
                  </span>
                </div>

                <div className={styles.mockupList}>
                  <div className={styles.mockupRow}>
                    <div className={styles.mockupMember}>
                      <div
                        className={styles.mockupAvatar}
                        style={{ backgroundColor: "#2563EB" }}
                      >
                        DA
                      </div>
                      <div className={styles.mockupInfo}>
                        <span className={styles.mockupName}>David Adeleke</span>
                        <span className={styles.mockupDept}>Choir & Music</span>
                      </div>
                    </div>
                    <span className={styles.mockupTime}>07:14 AM</span>
                  </div>

                  <div className={styles.mockupRow}>
                    <div className={styles.mockupMember}>
                      <div
                        className={styles.mockupAvatar}
                        style={{ backgroundColor: "#059669" }}
                      >
                        EP
                      </div>
                      <div className={styles.mockupInfo}>
                        <span className={styles.mockupName}>
                          Emmanuel Peters
                        </span>
                        <span className={styles.mockupDept}>Ushering Unit</span>
                      </div>
                    </div>
                    <span className={styles.mockupTime}>07:22 AM</span>
                  </div>

                  <div className={styles.mockupRow}>
                    <div className={styles.mockupMember}>
                      <div
                        className={styles.mockupAvatar}
                        style={{ backgroundColor: "#D97706" }}
                      >
                        CN
                      </div>
                      <div className={styles.mockupInfo}>
                        <span className={styles.mockupName}>Chidi Nwosu</span>
                        <span className={styles.mockupDept}>Media & Sound</span>
                      </div>
                    </div>
                    <span className={styles.mockupTime}>07:30 AM</span>
                  </div>
                </div>
              </div>

              <div>
                <h2 className={styles.slideTitle}>
                  Real-Time Workforce Attendance
                </h2>
                <p className={styles.slideSubtitle}>
                  Track workforce and staff clock-ins live during operational
                  hours, replacing manual paper rosters with instant verifiable
                  timestamps.
                </p>
              </div>
            </div>

            {/* SLIDE 1: Dual Presence Verification */}
            <div className={styles.carouselSlide}>
              <div className={styles.nodesVisual}>
                <div className={styles.nodeCard}>
                  <div className={styles.nodeIconCircle}>
                    <Wifi size={24} color="#059669" />
                  </div>
                  <span className={styles.nodeLabel}>Wi-Fi Anchor</span>
                  <span className={styles.nodeSub}>Router BSSID</span>
                </div>

                <div className={styles.nodeCard}>
                  <div className={styles.nodeIconCircle}>
                    <MapPin size={24} color="#2563EB" />
                  </div>
                  <span className={styles.nodeLabel}>GPS Fallback</span>
                  <span className={styles.nodeSub}>Venue Geofence</span>
                </div>
              </div>

              <div>
                <h2 className={styles.slideTitle}>
                  Dual-Layer Anti-Proxy Verification
                </h2>
                <p className={styles.slideSubtitle}>
                  Workers verify strictly on-premise using the premises Wi-Fi
                  router radio, with automated GPS perimeter matching during
                  connectivity failover.
                </p>
              </div>
            </div>

            {/* SLIDE 2: Audit Reports & CSV */}
            <div className={styles.carouselSlide}>
              <div className={styles.reportsMockup}>
                <div className={styles.reportsMockupHeader}>
                  <span>Monthly Compliance Matrix</span>
                  <FileSpreadsheet size={15} color="#2563EB" />
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr
                      style={{
                        fontSize: "0.65rem",
                        color: "#64748B",
                        borderBottom: "1px solid #E2E8F0",
                      }}
                    >
                      <th style={{ textAlign: "left", padding: "4px 0" }}>
                        Member
                      </th>
                      <th style={{ padding: "4px" }}>Sun 1</th>
                      <th style={{ padding: "4px" }}>Sun 8</th>
                      <th style={{ padding: "4px" }}>Rate</th>
                    </tr>
                  </thead>
                  <tbody style={{ fontSize: "0.7rem" }}>
                    <tr>
                      <td style={{ padding: "6px 0", fontWeight: 600 }}>
                        David A.
                      </td>
                      <td
                        style={{
                          textAlign: "center",
                          color: "#059669",
                          fontWeight: 600,
                        }}
                      >
                        07:14
                      </td>
                      <td
                        style={{
                          textAlign: "center",
                          color: "#059669",
                          fontWeight: 600,
                        }}
                      >
                        07:18
                      </td>
                      <td
                        style={{
                          textAlign: "center",
                          fontWeight: 700,
                          color: "#2563EB",
                        }}
                      >
                        100%
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: "6px 0", fontWeight: 600 }}>
                        Emmanuel P.
                      </td>
                      <td
                        style={{
                          textAlign: "center",
                          color: "#059669",
                          fontWeight: 600,
                        }}
                      >
                        07:22
                      </td>
                      <td
                        style={{
                          textAlign: "center",
                          color: "#059669",
                          fontWeight: 600,
                        }}
                      >
                        07:20
                      </td>
                      <td
                        style={{
                          textAlign: "center",
                          fontWeight: 700,
                          color: "#2563EB",
                        }}
                      >
                        100%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div>
                <h2 className={styles.slideTitle}>
                  Audit-Ready Leadership Reporting
                </h2>
                <p className={styles.slideSubtitle}>
                  Generate clean monthly matrices for pastors and departmental
                  heads, with instant CSV download and printable Landscape A4
                  layouts.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Pagination Dots */}
        <div className={styles.carouselPagination}>
          {[0, 1, 2].map((idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActiveSlide(idx)}
              className={`${styles.pageDot} ${activeSlide === idx ? styles.pageDotActive : ""}`}
              title={`Slide ${idx + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
