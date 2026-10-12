import React, { useState, useEffect } from "react";
import {
  Building2,
  Users,
  Clock,
  Plus,
  X,
  Save,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Lock,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import {
  validateAttendanceWindow,
  formatDurationMinutes,
  validateOrgName,
  validateBranchName,
  validateDeptName,
} from "../utils/formValidation";
import styles from "./SetupPage.module.css";

const DAYS_OF_WEEK = [
  { id: 0, label: "Sunday" },
  { id: 1, label: "Monday" },
  { id: 2, label: "Tuesday" },
  { id: 3, label: "Wednesday" },
  { id: 4, label: "Thursday" },
  { id: 5, label: "Friday" },
  { id: 6, label: "Saturday" },
];

export const SetupPage: React.FC = () => {
  const { church, updateChurch } = useAuth();

  const [churchName, setChurchName] = useState("");
  const [branchName, setBranchName] = useState("");
  const [churchCode, setChurchCode] = useState("");
  const [departments, setDepartments] = useState<string[]>([]);
  const [newDepartment, setNewDepartment] = useState("");
  const [serviceDays, setServiceDays] = useState<number[]>([0, 3]);
  const [arrivalCutoff, setArrivalCutoff] = useState("07:30");
  const [lateTolerance, setLateTolerance] = useState("07:45");
  const [syncCutoff, setSyncCutoff] = useState("12:00");

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Real-time regex and attendance window validation
  const timeValidation = validateAttendanceWindow(
    arrivalCutoff,
    lateTolerance,
    syncCutoff,
  );

  const orgNameValidation = churchName
    ? validateOrgName(churchName)
    : { isValid: true, error: null };
  const branchValidation = branchName
    ? validateBranchName(branchName)
    : { isValid: true, error: null };
  const [copiedCode, setCopiedCode] = useState(false);

  const handleCopyCode = () => {
    const code = church?.churchCode || churchCode;
    if (code) {
      navigator.clipboard.writeText(code);
      setCopiedCode(true);
      toast.success(`Copied Organization Code "${code}" to clipboard!`);
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

  useEffect(() => {
    if (church) {
      setChurchName(church.churchName || "");
      setBranchName(church.branchName || "");
      setChurchCode(church.churchCode || "");
      setDepartments(church.departments || []);
      setServiceDays(church.policySettings?.serviceDays || [0, 3]);
      setArrivalCutoff(church.policySettings?.arrivalCutoff || "07:30");
      setLateTolerance(church.policySettings?.lateTolerance || "07:45");
      setSyncCutoff(church.policySettings?.syncCutoff || "12:00");
    }
  }, [church]);

  const handleAddDepartment = () => {
    const trimmed = newDepartment.trim();
    if (!trimmed) return;
    const deptVal = validateDeptName(trimmed);
    if (!deptVal.isValid) {
      toast.error(deptVal.error);
      return;
    }
    if (departments.some((d) => d.toLowerCase() === trimmed.toLowerCase())) {
      toast.warn("Department already exists in your registry.");
      return;
    }
    setDepartments([...departments, trimmed]);
    setNewDepartment("");
    toast.success(`Added "${trimmed}" to departments.`);
  };

  const handleRemoveDepartment = (deptToRemove: string) => {
    if (departments.length <= 1) {
      toast.warn("At least one department is required.");
      return;
    }
    setDepartments(departments.filter((d) => d !== deptToRemove));
    toast.info(`Removed "${deptToRemove}".`);
  };

  const toggleDay = (dayId: number) => {
    if (serviceDays.includes(dayId)) {
      if (serviceDays.length === 1) {
        toast.warn("At least one active operating day must be selected.");
        return;
      }
      setServiceDays(serviceDays.filter((d) => d !== dayId));
    } else {
      setServiceDays([...serviceDays, dayId].sort());
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const orgVal = validateOrgName(churchName);
    if (!orgVal.isValid) {
      setError(orgVal.error);
      toast.error(orgVal.error);
      return;
    }

    const branchVal = validateBranchName(branchName);
    if (!branchVal.isValid) {
      setError(branchVal.error);
      toast.error(branchVal.error);
      return;
    }

    if (!timeValidation.isValid) {
      setError(timeValidation.errorMessage);
      toast.error(
        timeValidation.errorMessage || "Invalid sign-in window times.",
      );
      return;
    }

    setSaving(true);
    setSaveSuccess(false);

    try {
      await updateChurch({
        churchName,
        branchName,
        churchCode: church?.churchCode || churchCode.trim().toUpperCase(),
        departments,
        policySettings: {
          serviceDays,
          arrivalCutoff,
          lateTolerance,
          syncCutoff,
        },
      });

      setSaveSuccess(true);
      toast.success("Organization policy successfully saved!");
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(err.message);
      } else {
        toast.error("Failed to persist policy configurations.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className={styles.pageContainer}>
      <div className={styles.headerSection}>
        <div>
          <h1 className={styles.headerTitle}>
            Organization Onboarding & Policy
          </h1>
          <p className={styles.headerSubtitle}>
            Configure your ecclesiastical branch identity, workforce units, and
            time-fenced arrival policies.
          </p>
        </div>
      </div>

      {error && (
        <div
          className="badge badge-danger"
          style={{ padding: "10px 14px", borderRadius: "6px" }}
        >
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className={styles.formGrid}>
        {/* Section 1: Organization Identity */}
        <div className={styles.settingsCard}>
          <div className={styles.cardHeader}>
            <div className={styles.cardIcon}>
              <Building2 size={20} />
            </div>
            <div className={styles.cardTitles}>
              <h3>Organization Identity & Location</h3>
              <p>
                Canonical organization names and the unique identifier for
                employee mobile linking.
              </p>
            </div>
          </div>

          <div className={styles.inputsRow}>
            <div className={styles.fieldGroup}>
              <label htmlFor="churchName">Organization Name *</label>
              <input
                id="churchName"
                type="text"
                value={churchName}
                onChange={(e) => setChurchName(e.target.value)}
                placeholder="e.g. Acme Corporation or Apex Technologies"
                className={!orgNameValidation.isValid ? styles.inputError : ""}
                required
              />
              {!orgNameValidation.isValid && (
                <span className={styles.fieldErrorText}>
                  <AlertCircle size={12} /> {orgNameValidation.error}
                </span>
              )}
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="branchName">Branch / Office Location *</label>
              <input
                id="branchName"
                type="text"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder="e.g. Corporate Headquarters / Downtown Office"
                className={!branchValidation.isValid ? styles.inputError : ""}
                required
              />
              {!branchValidation.isValid && (
                <span className={styles.fieldErrorText}>
                  <AlertCircle size={12} /> {branchValidation.error}
                </span>
              )}
            </div>

            <div className={styles.fieldGroup}>
              <div className={styles.fieldLabelRow}>
                <label htmlFor="churchCode">Unique Organization Code</label>
                <span className={styles.lockedBadge}>
                  <Lock size={11} /> Permanent & Assigned
                </span>
              </div>
              <div className={styles.lockedInputRow}>
                <input
                  id="churchCode"
                  type="text"
                  className={`mono ${styles.lockedCodeInput}`}
                  value={church?.churchCode || churchCode}
                  readOnly
                  disabled
                  title="Organization code is permanently assigned and cannot be edited"
                />
                <button
                  type="button"
                  className={styles.copyCodeBtn}
                  onClick={handleCopyCode}
                  title="Copy Organization Code to clipboard"
                >
                  {copiedCode ? (
                    <>
                      <Check size={14} color="#059669" />
                      <span style={{ color: "#059669" }}>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>
              </div>
              <span className={styles.fieldHelp}>
                Permanently assigned system identifier. Members and personnel
                enter this code into the mobile app to pair with your branch.
              </span>
            </div>
          </div>
        </div>

        {/* Section 2: Department Configuration */}
        <div className={styles.settingsCard}>
          <div className={styles.cardHeader}>
            <div className={styles.cardIcon}>
              <Users size={20} />
            </div>
            <div className={styles.cardTitles}>
              <h3>Workforce Departments & Teams</h3>
              <p>
                Active departments and units that workers can join during
                on-premise onboarding.
              </p>
            </div>
          </div>

          <div className={styles.tagsContainer}>
            {departments.map((dept) => (
              <span key={dept} className={styles.tagItem}>
                <span>{dept}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveDepartment(dept)}
                  className={styles.tagRemoveBtn}
                  title={`Remove ${dept}`}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>

          <div className={styles.addTagRow}>
            <input
              type="text"
              value={newDepartment}
              onChange={(e) => setNewDepartment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddDepartment();
                }
              }}
              placeholder="Type department name (e.g. Engineering, Operations, Sales, Marketing)..."
              className={styles.addTagInput}
            />
            <button
              type="button"
              onClick={handleAddDepartment}
              className="btn btn-secondary"
            >
              <Plus size={16} />
              <span>Add Department</span>
            </button>
          </div>
        </div>

        {/* Section 3: Operational Schedule Policy */}
        <div className={styles.settingsCard}>
          <div className={styles.cardHeader}>
            <div className={styles.cardIcon}>
              <Clock size={20} />
            </div>
            <div className={styles.cardTitles}>
              <h3>Operational Schedule & Attendance Window Policy</h3>
              <p>
                Operating days and the daily time window during which mobile
                attendance check-in is unlocked.
              </p>
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label>Active Operating Days</label>
            <div className={styles.daysGrid}>
              {DAYS_OF_WEEK.map((day) => {
                const active = serviceDays.includes(day.id);
                return (
                  <button
                    key={day.id}
                    type="button"
                    onClick={() => toggleDay(day.id)}
                    className={`${styles.dayPill} ${active ? styles.dayPillActive : ""}`}
                  >
                    {day.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.inputsRow}>
            <div className={styles.fieldGroup}>
              <label htmlFor="arrivalCutoff">Sign-In Window Open Time *</label>
              <input
                id="arrivalCutoff"
                type="time"
                value={arrivalCutoff}
                onChange={(e) => setArrivalCutoff(e.target.value)}
                className={
                  !timeValidation.isOpenValidFormat ||
                  !timeValidation.isOrderValid
                    ? styles.inputError
                    : ""
                }
                required
              />
              {!timeValidation.isOpenValidFormat ? (
                <span className={styles.fieldErrorText}>
                  <AlertCircle size={12} /> Format must be HH:mm (e.g. 07:00 AM)
                </span>
              ) : !timeValidation.isOrderValid ? (
                <span className={styles.fieldErrorText}>
                  <AlertCircle size={12} /> Open time must be earlier than close
                  time ({timeValidation.formattedClose})
                </span>
              ) : (
                <span className={styles.fieldHelp}>
                  Daily time when the mobile app unlocks and begins accepting
                  check-ins ({timeValidation.formattedOpen}).
                </span>
              )}
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="lateTolerance">Sign-In Window Close Time *</label>
              <input
                id="lateTolerance"
                type="time"
                value={lateTolerance}
                onChange={(e) => setLateTolerance(e.target.value)}
                className={
                  !timeValidation.isCloseValidFormat ||
                  !timeValidation.isOrderValid
                    ? styles.inputError
                    : ""
                }
                required
              />
              {!timeValidation.isCloseValidFormat ? (
                <span className={styles.fieldErrorText}>
                  <AlertCircle size={12} /> Format must be HH:mm (e.g. 07:30 AM)
                </span>
              ) : !timeValidation.isOrderValid ? (
                <span className={styles.fieldErrorText}>
                  <AlertCircle size={12} /> Close time must be later than open
                  time ({timeValidation.formattedOpen})
                </span>
              ) : (
                <span className={styles.fieldHelp}>
                  Daily time when the sign-in window closes (
                  {timeValidation.formattedClose}). App locks immediately with
                  zero late tolerance.
                </span>
              )}
            </div>

            <div className={styles.fieldGroup}>
              <label htmlFor="syncCutoff">Daily Cloud Sync Cutoff</label>
              <input
                id="syncCutoff"
                type="time"
                value={syncCutoff}
                onChange={(e) => setSyncCutoff(e.target.value)}
                className={
                  !timeValidation.isSyncValidFormat ? styles.inputError : ""
                }
                required
              />
              {!timeValidation.isSyncValidFormat ? (
                <span className={styles.fieldErrorText}>
                  <AlertCircle size={12} /> Format must be HH:mm (e.g. 12:00 PM)
                </span>
              ) : (
                <span className={styles.fieldHelp}>
                  Latest permitted time for offline device buffers to
                  synchronize without administrator review.
                </span>
              )}
            </div>
          </div>

          {/* Immediate Real-time Validation Prompt Alert or Strict Window Notice */}
          {!timeValidation.isValid ? (
            <div className={styles.timeAlertError} role="alert">
              <AlertTriangle size={18} className={styles.timeAlertIcon} />
              <div>
                <strong>Invalid Time Window:</strong>{" "}
                {timeValidation.errorMessage}
              </div>
            </div>
          ) : (
            <div className={styles.timeAlertSuccess}>
              <Clock size={18} className={styles.timeAlertIcon} />
              <div>
                <strong>Strict Check-In Window:</strong> Mobile sign-in opens at{" "}
                <strong>{timeValidation.formattedOpen}</strong> and closes
                strictly at <strong>{timeValidation.formattedClose}</strong> (
                {formatDurationMinutes(timeValidation.durationMinutes)} active
                window). Submissions after {timeValidation.formattedClose} are
                rejected — zero late tolerance.
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={styles.actionsBar}>
        {saveSuccess && (
          <span className={styles.saveSuccess}>
            <CheckCircle2 size={16} />
            <span>Policy configurations successfully saved.</span>
          </span>
        )}
        <button
          type="submit"
          disabled={saving || !timeValidation.isValid}
          className="btn btn-primary"
          style={{
            opacity: !timeValidation.isValid ? 0.6 : 1,
            cursor: !timeValidation.isValid ? "not-allowed" : "pointer",
          }}
        >
          <Save size={16} />
          <span>
            {saving ? "Saving Changes..." : "Save Organization Policy"}
          </span>
        </button>
      </div>
    </form>
  );
};
