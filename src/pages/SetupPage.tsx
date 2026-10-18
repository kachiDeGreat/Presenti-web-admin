import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
  Trash2,
  RotateCcw,
  Calendar,
} from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import type { DaySchedule } from "../types";
import {
  validateAttendanceWindow,
  validateDaySchedules,
  format12Hour,
  formatDurationMinutes,
  validateOrgName,
  validateBranchName,
  validateDeptName,
} from "../utils/formValidation";
import styles from "./SetupPage.module.css";

const DAYS_OF_WEEK = [
  { id: 0, label: "Sunday", name: "Sun" },
  { id: 1, label: "Monday", name: "Mon" },
  { id: 2, label: "Tuesday", name: "Tue" },
  { id: 3, label: "Wednesday", name: "Wed" },
  { id: 4, label: "Thursday", name: "Thu" },
  { id: 5, label: "Friday", name: "Fri" },
  { id: 6, label: "Saturday", name: "Sat" },
];

export const SetupPage: React.FC = () => {
  const { church, updateChurch, deleteChurchWorkspace } = useAuth();
  const navigate = useNavigate();
  const [isResettingWorkspace, setIsResettingWorkspace] = useState(false);

  const [churchName, setChurchName] = useState("");
  const [branchName, setBranchName] = useState("");
  const [churchCode, setChurchCode] = useState("");
  const [departments, setDepartments] = useState<string[]>([]);
  const [newDepartment, setNewDepartment] = useState("");
  const [serviceDays, setServiceDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [scheduleMode, setScheduleMode] = useState<"UNIFIED" | "PER_DAY">("UNIFIED");
  const [arrivalCutoff, setArrivalCutoff] = useState("07:00");
  const [lateTolerance, setLateTolerance] = useState("07:30");
  const [allowLateSignIn, setAllowLateSignIn] = useState(true);
  const [enableSignOut, setEnableSignOut] = useState(false);
  const [signOutTime, setSignOutTime] = useState("17:00");
  const [daySchedules, setDaySchedules] = useState<Record<number, DaySchedule>>({});
  const [activeScheduleDay, setActiveScheduleDay] = useState<number>(1);

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Real-time regex and attendance window validation for unified mode
  const timeValidation = validateAttendanceWindow(
    arrivalCutoff,
    lateTolerance,
    enableSignOut,
    signOutTime,
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
      const loadedDays = church.policySettings?.serviceDays || [1, 2, 3, 4, 5];
      setServiceDays(loadedDays);
      setScheduleMode(church.policySettings?.scheduleMode || "UNIFIED");
      setArrivalCutoff(church.policySettings?.arrivalCutoff || "07:00");
      setLateTolerance(church.policySettings?.lateTolerance || "07:30");
      setAllowLateSignIn(church.policySettings?.allowLateSignIn !== false);
      setEnableSignOut(!!church.policySettings?.enableSignOut);
      setSignOutTime(church.policySettings?.signOutTime || "17:00");
      if (church.policySettings?.daySchedules) {
        setDaySchedules(church.policySettings.daySchedules as Record<number, DaySchedule>);
      }
      if (loadedDays.length > 0) {
        setActiveScheduleDay(loadedDays[0]);
      }
    }
  }, [church]);

  const getActiveDaySchedule = (dayId: number): DaySchedule => {
    if (daySchedules[dayId]) {
      return daySchedules[dayId];
    }
    return {
      arrivalCutoff,
      lateTolerance,
      allowLateSignIn,
      enableSignOut,
      signOutTime,
    };
  };

  const updateDaySchedule = (dayId: number, patch: Partial<DaySchedule>) => {
    setDaySchedules((prev) => {
      const current = prev[dayId] || {
        arrivalCutoff,
        lateTolerance,
        allowLateSignIn,
        enableSignOut,
        signOutTime,
      };
      return {
        ...prev,
        [dayId]: {
          ...current,
          ...patch,
        },
      };
    });
  };

  const copyActiveDayToAll = () => {
    const activeSched = getActiveDaySchedule(activeScheduleDay);
    const updated: Record<number, DaySchedule> = {};
    serviceDays.forEach((d) => {
      updated[d] = { ...activeSched };
    });
    setDaySchedules(updated);
    const activeName = DAYS_OF_WEEK.find((w) => w.id === activeScheduleDay)?.label || "Selected day";
    toast.success(`Applied ${activeName}'s schedule to all ${serviceDays.length} selected days.`);
  };

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
      const updated = serviceDays.filter((d) => d !== dayId);
      setServiceDays(updated);
      if (activeScheduleDay === dayId && updated.length > 0) {
        setActiveScheduleDay(updated[0]);
      }
    } else {
      const updated = [...serviceDays, dayId].sort();
      setServiceDays(updated);
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

    if (scheduleMode === "UNIFIED") {
      if (!timeValidation.isValid) {
        setError(timeValidation.errorMessage);
        toast.error(
          timeValidation.errorMessage || "Invalid sign-in window times.",
        );
        return;
      }
    } else {
      const defaultSched: DaySchedule = {
        arrivalCutoff,
        lateTolerance,
        allowLateSignIn,
        enableSignOut,
        signOutTime,
      };
      const perDayVal = validateDaySchedules(serviceDays, daySchedules, defaultSched);
      if (!perDayVal.isValid) {
        setError(perDayVal.firstError);
        toast.error(perDayVal.firstError || "Please correct day-specific schedule times.");
        return;
      }
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
          scheduleMode,
          arrivalCutoff,
          lateTolerance,
          allowLateSignIn,
          enableSignOut,
          signOutTime: enableSignOut ? signOutTime : undefined,
          daySchedules: scheduleMode === "PER_DAY" ? daySchedules : undefined,
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

  const isSubmitDisabled =
    saving ||
    (scheduleMode === "UNIFIED"
      ? !timeValidation.isValid
      : !validateDaySchedules(
          serviceDays,
          daySchedules,
          getActiveDaySchedule(activeScheduleDay),
        ).isValid);

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

          {/* Schedule Mode Selector */}
          <div className={styles.fieldGroup}>
            <label>Schedule Mode</label>
            <span className={styles.fieldHelp}>
              Choose whether all selected operating days share identical call-up hours or have customized times per day.
            </span>
            <div className={styles.scheduleModeSegment}>
              <button
                type="button"
                className={`${styles.scheduleModeBtn} ${scheduleMode === "UNIFIED" ? styles.scheduleModeBtnActive : ""}`}
                onClick={() => setScheduleMode("UNIFIED")}
              >
                <div className={styles.scheduleModeBtnTitle}>
                  <Clock size={16} />
                  <span>One Time for All Days</span>
                </div>
                <div className={styles.scheduleModeBtnDesc}>
                  Use a single unified check-in, late tolerance, and sign-out window across all active days.
                </div>
              </button>
              <button
                type="button"
                className={`${styles.scheduleModeBtn} ${scheduleMode === "PER_DAY" ? styles.scheduleModeBtnActive : ""}`}
                onClick={() => {
                  setScheduleMode("PER_DAY");
                  if (serviceDays.length > 0 && !serviceDays.includes(activeScheduleDay)) {
                    setActiveScheduleDay(serviceDays[0]);
                  }
                }}
              >
                <div className={styles.scheduleModeBtnTitle}>
                  <Calendar size={16} />
                  <span>Different Times per Day</span>
                </div>
                <div className={styles.scheduleModeBtnDesc}>
                  Customize individual check-in cutoff, late tolerance, and sign-out hours for each operating day.
                </div>
              </button>
            </div>
          </div>

          {/* Mode 1: Unified Schedule */}
          {scheduleMode === "UNIFIED" && (
            <>
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
                      <AlertCircle size={12} /> Open time must be earlier than close time ({timeValidation.formattedClose})
                    </span>
                  ) : (
                    <span className={styles.fieldHelp}>
                      Daily time when the mobile app unlocks and begins accepting check-ins ({timeValidation.formattedOpen}).
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
                      <AlertCircle size={12} /> Close time must be later than open time ({timeValidation.formattedOpen})
                    </span>
                  ) : (
                    <span className={styles.fieldHelp}>
                      {allowLateSignIn
                        ? `Official arrival deadline (${timeValidation.formattedClose}). Check-ins after this time will carry a LATE tag.`
                        : `Strict check-in cutoff (${timeValidation.formattedClose}). App locks immediately with zero late tolerance.`}
                    </span>
                  )}
                </div>
              </div>

              {/* Policy Toggles */}
              <div className={styles.policyTogglesList}>
                {/* Toggle 1: Allow Late Sign-In */}
                <div
                  className={`${styles.toggleCard} ${allowLateSignIn ? styles.toggleCardActive : ""}`}
                  onClick={() => setAllowLateSignIn(!allowLateSignIn)}
                  role="button"
                  tabIndex={0}
                >
                  <div className={styles.toggleCardInfo}>
                    <div className={styles.toggleCardTitle}>
                      <span>Allow Late Sign-In</span>
                      <span
                        className={`${styles.toggleTag} ${allowLateSignIn ? styles.tagAmber : styles.tagSlate}`}
                      >
                        {allowLateSignIn ? "Late Tagging Active" : "Strict Lockout"}
                      </span>
                    </div>
                    <div className={styles.toggleCardDesc}>
                      {allowLateSignIn
                        ? `Workers arriving after ${timeValidation.formattedClose} can still clock in, but their record will be explicitly tagged as LATE in audit records.`
                        : `Attendance strictly locks at ${timeValidation.formattedClose}. No sign-ins allowed once the window closes.`}
                    </div>
                  </div>
                  <div
                    className={`${styles.toggleSwitch} ${allowLateSignIn ? styles.toggleSwitchChecked : ""}`}
                  >
                    <div className={styles.toggleThumb} />
                  </div>
                </div>

                {/* Toggle 2: Enable Sign-Out */}
                <div
                  className={`${styles.toggleCard} ${enableSignOut ? styles.toggleCardActive : ""}`}
                  onClick={() => setEnableSignOut(!enableSignOut)}
                  role="button"
                  tabIndex={0}
                >
                  <div className={styles.toggleCardInfo}>
                    <div className={styles.toggleCardTitle}>
                      <span>Enable Worker Sign-Out</span>
                      <span
                        className={`${styles.toggleTag} ${enableSignOut ? styles.tagBlue : styles.tagSlate}`}
                      >
                        {enableSignOut ? "Sign-Out Enabled" : "Check-In Only"}
                      </span>
                    </div>
                    <div className={styles.toggleCardDesc}>
                      {enableSignOut
                        ? "Workers are required or permitted to sign out at the end of their shift."
                        : "Workers only sign in once. Sign-out is disabled."}
                    </div>
                  </div>
                  <div
                    className={`${styles.toggleSwitch} ${enableSignOut ? styles.toggleSwitchChecked : ""}`}
                  >
                    <div className={styles.toggleThumb} />
                  </div>
                </div>

                {/* Conditional Sign-Out Time Input */}
                {enableSignOut && (
                  <div
                    style={{
                      backgroundColor: "#EFF6FF",
                      border: "1.5px solid #BFDBFE",
                      borderRadius: 12,
                      padding: 16,
                      marginTop: 4,
                    }}
                  >
                    <div className={styles.fieldGroup}>
                      <label htmlFor="signOutTime" style={{ color: "#1E3A8A" }}>
                        Sign-Out Earliest Time *
                      </label>
                      <input
                        id="signOutTime"
                        type="time"
                        value={signOutTime}
                        onChange={(e) => setSignOutTime(e.target.value)}
                        className={
                          !timeValidation.isSignOutValidFormat
                            ? styles.inputError
                            : ""
                        }
                        required
                      />
                      {!timeValidation.isSignOutValidFormat ? (
                        <span className={styles.fieldErrorText}>
                          <AlertCircle size={12} /> Format must be HH:mm (e.g. 05:00 PM)
                        </span>
                      ) : (
                        <span className={styles.fieldHelp} style={{ color: "#3B82F6" }}>
                          Earliest time workers can sign out (
                          {timeValidation.formattedSignOut || "05:00 PM"}). Workers
                          can sign out anytime from this time onwards — there is no close cutoff.
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Immediate Real-time Validation Prompt Alert */}
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
                    <strong>Configured Unified Policy:</strong> Sign-in opens at{" "}
                    <strong>{timeValidation.formattedOpen}</strong> with official arrival deadline at{" "}
                    <strong>{timeValidation.formattedClose}</strong> ({formatDurationMinutes(timeValidation.durationMinutes)} active window).{" "}
                    {allowLateSignIn
                      ? "Check-ins after close time are permitted and stamped as LATE."
                      : "Check-in window strictly locks at close time."}{" "}
                    {enableSignOut
                      ? `Sign-out begins at ${timeValidation.formattedSignOut || "05:00 PM"} (no closing cutoff).`
                      : "Sign-out is disabled."}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Mode 2: Per-Day Schedule */}
          {scheduleMode === "PER_DAY" && (
            <>
              {serviceDays.length === 0 ? (
                <div className={styles.timeAlertError} style={{ marginTop: 12 }}>
                  <AlertTriangle size={18} className={styles.timeAlertIcon} />
                  <div>
                    Please select at least one active operating day above to configure day-specific hours.
                  </div>
                </div>
              ) : (
                <>
                  <div className={styles.fieldGroup} style={{ marginTop: 8 }}>
                    <label>Select Day to Configure</label>
                    <span className={styles.fieldHelp}>
                      Pick an active day from your selection above to customize its sign-in and sign-out times.
                    </span>
                    <div className={styles.dayTabsList}>
                      {serviceDays.map((d) => {
                        const dayObj = DAYS_OF_WEEK.find((w) => w.id === d);
                        const sched = getActiveDaySchedule(d);
                        const isSelected = activeScheduleDay === d;
                        return (
                          <button
                            key={d}
                            type="button"
                            className={`${styles.dayTabBtn} ${isSelected ? styles.dayTabBtnActive : ""}`}
                            onClick={() => setActiveScheduleDay(d)}
                          >
                            <span>{dayObj?.name || `Day ${d}`}</span>
                            <span className={styles.dayTabHoursBadge}>
                              {format12Hour(sched.arrivalCutoff)} - {format12Hour(sched.lateTolerance)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Active Day Schedule Editor */}
                  {(() => {
                    const activeSched = getActiveDaySchedule(activeScheduleDay);
                    const activeDayObj = DAYS_OF_WEEK.find((w) => w.id === activeScheduleDay);
                    const dayVal = validateAttendanceWindow(
                      activeSched.arrivalCutoff,
                      activeSched.lateTolerance,
                      activeSched.enableSignOut,
                      activeSched.signOutTime,
                    );

                    return (
                      <div className={styles.dayEditorBox}>
                        <div className={styles.dayEditorHeader}>
                          <div>
                            <div className={styles.dayEditorTitle}>
                              <Calendar size={18} color="#2563EB" />
                              <span>{activeDayObj?.label || "Day"} Schedule Configuration</span>
                            </div>
                            <span className={styles.dayEditorSub}>
                              Setting times specifically for {activeDayObj?.label}.
                            </span>
                          </div>
                          <button
                            type="button"
                            className={styles.copyAllBtn}
                            onClick={copyActiveDayToAll}
                            title={`Copy ${activeDayObj?.label} times to all selected active days`}
                          >
                            <Copy size={13} />
                            <span>Apply to All Active Days</span>
                          </button>
                        </div>

                        <div className={styles.inputsRow}>
                          <div className={styles.fieldGroup}>
                            <label htmlFor={`arrivalCutoff_${activeScheduleDay}`}>
                              Sign-In Window Open Time *
                            </label>
                            <input
                              id={`arrivalCutoff_${activeScheduleDay}`}
                              type="time"
                              value={activeSched.arrivalCutoff}
                              onChange={(e) =>
                                updateDaySchedule(activeScheduleDay, { arrivalCutoff: e.target.value })
                              }
                              className={
                                !dayVal.isOpenValidFormat || !dayVal.isOrderValid
                                  ? styles.inputError
                                  : ""
                              }
                              required
                            />
                            {!dayVal.isOpenValidFormat ? (
                              <span className={styles.fieldErrorText}>
                                <AlertCircle size={12} /> Format must be HH:mm (e.g. 07:00 AM)
                              </span>
                            ) : !dayVal.isOrderValid ? (
                              <span className={styles.fieldErrorText}>
                                <AlertCircle size={12} /> Open time must be earlier than close time ({dayVal.formattedClose})
                              </span>
                            ) : (
                              <span className={styles.fieldHelp}>
                                Check-in starts at {dayVal.formattedOpen} on {activeDayObj?.label}.
                              </span>
                            )}
                          </div>

                          <div className={styles.fieldGroup}>
                            <label htmlFor={`lateTolerance_${activeScheduleDay}`}>
                              Sign-In Window Close Time *
                            </label>
                            <input
                              id={`lateTolerance_${activeScheduleDay}`}
                              type="time"
                              value={activeSched.lateTolerance}
                              onChange={(e) =>
                                updateDaySchedule(activeScheduleDay, { lateTolerance: e.target.value })
                              }
                              className={
                                !dayVal.isCloseValidFormat || !dayVal.isOrderValid
                                  ? styles.inputError
                                  : ""
                              }
                              required
                            />
                            {!dayVal.isCloseValidFormat ? (
                              <span className={styles.fieldErrorText}>
                                <AlertCircle size={12} /> Format must be HH:mm (e.g. 07:30 AM)
                              </span>
                            ) : !dayVal.isOrderValid ? (
                              <span className={styles.fieldErrorText}>
                                <AlertCircle size={12} /> Close time must be later than open time ({dayVal.formattedOpen})
                              </span>
                            ) : (
                              <span className={styles.fieldHelp}>
                                {activeSched.allowLateSignIn
                                  ? `Arrival deadline (${dayVal.formattedClose}). Sign-ins after this will carry a LATE tag.`
                                  : `Strict check-in cutoff (${dayVal.formattedClose}). Check-ins stop immediately.`}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Day-specific Policy Toggles */}
                        <div className={styles.policyTogglesList}>
                          <div
                            className={`${styles.toggleCard} ${activeSched.allowLateSignIn ? styles.toggleCardActive : ""}`}
                            onClick={() =>
                              updateDaySchedule(activeScheduleDay, {
                                allowLateSignIn: !activeSched.allowLateSignIn,
                              })
                            }
                            role="button"
                            tabIndex={0}
                          >
                            <div className={styles.toggleCardInfo}>
                              <div className={styles.toggleCardTitle}>
                                <span>Allow Late Sign-In</span>
                                <span
                                  className={`${styles.toggleTag} ${activeSched.allowLateSignIn ? styles.tagAmber : styles.tagSlate}`}
                                >
                                  {activeSched.allowLateSignIn ? "Late Tagging Active" : "Strict Lockout"}
                                </span>
                              </div>
                              <div className={styles.toggleCardDesc}>
                                {activeSched.allowLateSignIn
                                  ? `On ${activeDayObj?.label}, workers arriving after ${dayVal.formattedClose} can still clock in, tagged as LATE.`
                                  : `On ${activeDayObj?.label}, attendance strictly locks at ${dayVal.formattedClose}.`}
                              </div>
                            </div>
                            <div
                              className={`${styles.toggleSwitch} ${activeSched.allowLateSignIn ? styles.toggleSwitchChecked : ""}`}
                            >
                              <div className={styles.toggleThumb} />
                            </div>
                          </div>

                          <div
                            className={`${styles.toggleCard} ${activeSched.enableSignOut ? styles.toggleCardActive : ""}`}
                            onClick={() =>
                              updateDaySchedule(activeScheduleDay, {
                                enableSignOut: !activeSched.enableSignOut,
                              })
                            }
                            role="button"
                            tabIndex={0}
                          >
                            <div className={styles.toggleCardInfo}>
                              <div className={styles.toggleCardTitle}>
                                <span>Enable Worker Sign-Out</span>
                                <span
                                  className={`${styles.toggleTag} ${activeSched.enableSignOut ? styles.tagBlue : styles.tagSlate}`}
                                >
                                  {activeSched.enableSignOut ? "Sign-Out Enabled" : "Check-In Only"}
                                </span>
                              </div>
                              <div className={styles.toggleCardDesc}>
                                {activeSched.enableSignOut
                                  ? `Workers can sign out on ${activeDayObj?.label}.`
                                  : `Sign-out is disabled for ${activeDayObj?.label}.`}
                              </div>
                            </div>
                            <div
                              className={`${styles.toggleSwitch} ${activeSched.enableSignOut ? styles.toggleSwitchChecked : ""}`}
                            >
                              <div className={styles.toggleThumb} />
                            </div>
                          </div>

                          {activeSched.enableSignOut && (
                            <div
                              style={{
                                backgroundColor: "#EFF6FF",
                                border: "1.5px solid #BFDBFE",
                                borderRadius: 12,
                                padding: 16,
                                marginTop: 4,
                              }}
                            >
                              <div className={styles.fieldGroup}>
                                <label
                                  htmlFor={`signOutTime_${activeScheduleDay}`}
                                  style={{ color: "#1E3A8A" }}
                                >
                                  Sign-Out Earliest Time *
                                </label>
                                <input
                                  id={`signOutTime_${activeScheduleDay}`}
                                  type="time"
                                  value={activeSched.signOutTime || "17:00"}
                                  onChange={(e) =>
                                    updateDaySchedule(activeScheduleDay, {
                                      signOutTime: e.target.value,
                                    })
                                  }
                                  className={
                                    !dayVal.isSignOutValidFormat ? styles.inputError : ""
                                  }
                                  required
                                />
                                {!dayVal.isSignOutValidFormat ? (
                                  <span className={styles.fieldErrorText}>
                                    <AlertCircle size={12} /> Format must be HH:mm (e.g. 05:00 PM)
                                  </span>
                                ) : (
                                  <span className={styles.fieldHelp} style={{ color: "#3B82F6" }}>
                                    Earliest time workers can sign out on {activeDayObj?.label} (
                                    {dayVal.formattedSignOut || "05:00 PM"}).
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {!dayVal.isValid ? (
                          <div className={styles.timeAlertError} role="alert">
                            <AlertTriangle size={18} className={styles.timeAlertIcon} />
                            <div>
                              <strong>Invalid Time for {activeDayObj?.label}:</strong> {dayVal.errorMessage}
                            </div>
                          </div>
                        ) : (
                          <div className={styles.timeAlertSuccess}>
                            <Clock size={18} className={styles.timeAlertIcon} />
                            <div>
                              <strong>{activeDayObj?.label} Policy:</strong> Check-in open between{" "}
                              <strong>{dayVal.formattedOpen}</strong> and <strong>{dayVal.formattedClose}</strong>
                              {activeSched.enableSignOut ? ` • Sign-out starts at ${dayVal.formattedSignOut}` : " • Check-in only"}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* All Days Overview Cards */}
                  <div className={styles.dayOverviewGrid}>
                    {serviceDays.map((d) => {
                      const dayObj = DAYS_OF_WEEK.find((w) => w.id === d);
                      const sched = getActiveDaySchedule(d);
                      const isOpen = sched.arrivalCutoff;
                      const isClose = sched.lateTolerance;
                      return (
                        <div
                          key={d}
                          className={styles.dayOverviewCard}
                          style={{
                            borderColor: activeScheduleDay === d ? "#2563EB" : undefined,
                            backgroundColor: activeScheduleDay === d ? "#EFF6FF" : undefined,
                            cursor: "pointer",
                          }}
                          onClick={() => setActiveScheduleDay(d)}
                        >
                          <div className={styles.dayOverviewDayName}>
                            {dayObj?.label} {activeScheduleDay === d && "• Editing"}
                          </div>
                          <div className={styles.dayOverviewTime}>
                            {format12Hour(isOpen)} - {format12Hour(isClose)}
                          </div>
                          <div className={styles.dayOverviewDetails}>
                            {sched.allowLateSignIn ? "Late tag allowed" : "Strict cutoff"}
                            {sched.enableSignOut ? ` • Sign-out ${format12Hour(sched.signOutTime || "17:00")}` : " • No sign-out"}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </>
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
          disabled={isSubmitDisabled}
          className="btn btn-primary"
          style={{
            opacity: isSubmitDisabled ? 0.6 : 1,
            cursor: isSubmitDisabled ? "not-allowed" : "pointer",
          }}
        >
          <Save size={16} />
          <span>
            {saving ? "Saving Changes..." : "Save Organization Policy"}
          </span>
        </button>
      </div>

      {/* Danger Zone: Workspace Reset & Re-onboarding */}
      <div
        style={{
          marginTop: "2.5rem",
          padding: "1.5rem",
          backgroundColor: "#FFF1F2",
          border: "1px solid #FECDD3",
          borderRadius: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              backgroundColor: "#FFE4E6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#E11D48",
              flexShrink: 0,
            }}
          >
            <Trash2 size={20} />
          </div>
          <div>
            <h4
              style={{
                margin: 0,
                fontSize: "1rem",
                fontWeight: 700,
                color: "#9F1239",
              }}
            >
              Danger Zone: Reset Organization Workspace
            </h4>
            <p
              style={{
                margin: "3px 0 0",
                fontSize: "0.825rem",
                color: "#BE123C",
                lineHeight: 1.4,
              }}
            >
              Permanently wipe this workspace from Firestore, purge all cached members and attendance records from this browser, and restart the onboarding process from scratch.
            </p>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={async () => {
              const confirmed = window.confirm(
                "Are you sure you want to completely reset this organization workspace?\n\nThis will permanently delete this organization from Firestore, clear all local workspace cache, and return you to step-by-step onboarding to configure a fresh workspace from scratch."
              );
              if (!confirmed) return;

              try {
                setIsResettingWorkspace(true);
                await deleteChurchWorkspace();
                toast.success("Workspace reset successfully. Opening onboarding setup...");
                navigate("/onboarding", { replace: true });
              } catch (err) {
                console.error("Error resetting workspace:", err);
                toast.error("Failed to reset workspace. Please try again.");
              } finally {
                setIsResettingWorkspace(false);
              }
            }}
            disabled={isResettingWorkspace}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 18px",
              backgroundColor: "#E11D48",
              color: "#FFFFFF",
              border: "none",
              borderRadius: "8px",
              fontWeight: 600,
              fontSize: "0.875rem",
              cursor: isResettingWorkspace ? "not-allowed" : "pointer",
              opacity: isResettingWorkspace ? 0.7 : 1,
              transition: "background-color 0.15s ease",
            }}
          >
            <RotateCcw size={16} />
            <span>
              {isResettingWorkspace
                ? "Resetting Workspace..."
                : "Reset Workspace & Re-onboard"}
            </span>
          </button>
        </div>
      </div>
    </form>
  );
};
