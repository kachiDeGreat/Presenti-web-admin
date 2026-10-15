import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
  User,
  Phone,
  Mail,
  RefreshCw,
  Copy,
  MapPin,
  Globe,
  Loader2,
} from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import {
  validateAttendanceWindow,
  formatDurationMinutes,
  validateOrgName,
  validateBranchName,
  validateChurchCode,
  validatePersonName,
  validatePhoneNumber,
  validateDeptName,
} from "../utils/formValidation";
import styles from "./OnboardingPage.module.css";

export const COUNTRIES = [
  "Nigeria",
  "Ghana",
  "Kenya",
  "South Africa",
  "United Kingdom",
  "United States",
  "Canada",
  "Australia",
  "Germany",
  "France",
  "United Arab Emirates",
  "India",
  "Rwanda",
  "Uganda",
  "Tanzania",
  "Cameroon",
  "Other",
];

export const NIGERIA_STATES = [
  "Abia",
  "Adamawa",
  "Akwa Ibom",
  "Anambra",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "FCT - Abuja",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Kano",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Lagos",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Oyo",
  "Plateau",
  "Rivers",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
];

export const DEFAULT_STATE_COORDS: Record<string, { lat: number; lng: number }> = {
  Abia: { lat: 5.532, lng: 7.486 },
  Adamawa: { lat: 9.3265, lng: 12.4485 },
  "Akwa Ibom": { lat: 5.0377, lng: 7.9128 },
  Anambra: { lat: 6.2209, lng: 7.0674 },
  Bauchi: { lat: 10.3159, lng: 9.8442 },
  Bayelsa: { lat: 4.7719, lng: 6.0699 },
  Benue: { lat: 7.7322, lng: 8.5214 },
  Borno: { lat: 11.8333, lng: 13.15 },
  "Cross River": { lat: 4.975, lng: 8.3417 },
  Delta: { lat: 5.5325, lng: 5.8987 },
  Ebonyi: { lat: 6.2649, lng: 8.0137 },
  Edo: { lat: 6.335, lng: 5.6037 },
  Ekiti: { lat: 7.6219, lng: 5.2215 },
  Enugu: { lat: 6.4584, lng: 7.5464 },
  "FCT - Abuja": { lat: 9.0765, lng: 7.3986 },
  Gombe: { lat: 10.2897, lng: 11.1673 },
  Imo: { lat: 5.4836, lng: 7.0333 },
  Jigawa: { lat: 12.228, lng: 9.5616 },
  Kaduna: { lat: 10.5105, lng: 7.4165 },
  Kano: { lat: 12.0022, lng: 8.592 },
  Katsina: { lat: 12.9908, lng: 7.6018 },
  Kebbi: { lat: 12.4504, lng: 4.1999 },
  Kogi: { lat: 7.7969, lng: 6.7408 },
  Kwara: { lat: 8.4966, lng: 4.5421 },
  Lagos: { lat: 6.5244, lng: 3.3792 },
  Nasarawa: { lat: 8.5475, lng: 8.523 },
  Niger: { lat: 9.9309, lng: 5.5983 },
  Ogun: { lat: 7.1557, lng: 3.3451 },
  Ondo: { lat: 7.2571, lng: 5.2058 },
  Osun: { lat: 7.7827, lng: 4.5418 },
  Oyo: { lat: 7.3775, lng: 3.947 },
  Plateau: { lat: 9.9309, lng: 8.8921 },
  Rivers: { lat: 4.8156, lng: 7.0498 },
  Sokoto: { lat: 13.0059, lng: 5.2476 },
  Taraba: { lat: 8.8937, lng: 11.3606 },
  Yobe: { lat: 12.0, lng: 11.5 },
  Zamfara: { lat: 12.1222, lng: 6.2236 },
};

const DEPARTMENT_PRESETS = [
  "Engineering & Technology",
  "Operations & Logistics",
  "Media, Creative & Marketing",
  "Administration & HR",
  "Finance & Accounting",
  "Customer Support & Success",
  "Security & Facility Management",
  "Legal & Compliance",
  "Executive & Management",
];

const WEEK_DAYS = [
  { id: 0, name: "Sun", label: "Sunday" },
  { id: 1, name: "Mon", label: "Monday" },
  { id: 2, name: "Tue", label: "Tuesday" },
  { id: 3, name: "Wed", label: "Wednesday" },
  { id: 4, name: "Thu", label: "Thursday" },
  { id: 5, name: "Fri", label: "Friday" },
  { id: 6, name: "Sat", label: "Saturday" },
];

export const OnboardingPage: React.FC = () => {
  const { user, church, loading, createChurchWorkspace } = useAuth();
  const navigate = useNavigate();

  // Active Workspace Guard: Auto-redirect if user already has an active church workspace
  useEffect(() => {
    if (!loading && church) {
      navigate("/dashboard", { replace: true });
    }
  }, [church, loading, navigate]);

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: Church Identity & Administrator Information
  const [churchName, setChurchName] = useState("");
  const [branchName, setBranchName] = useState("");
  const [churchCode, setChurchCode] = useState("");
  const [adminName, setAdminName] = useState(user?.displayName || "");
  const [adminPhone, setAdminPhone] = useState("");

  // Structured Location Selection State (Country, State, City)
  const [country, setCountry] = useState("Nigeria");
  const [state, setState] = useState("");
  const [city, setCity] = useState("");

  // Keep adminName in sync if user profile loads asynchronously
  useEffect(() => {
    if (user?.displayName && !adminName) {
      setAdminName(user.displayName);
    }
  }, [user, adminName]);

  // Step 2: Workforce Units
  const [departments, setDepartments] = useState<string[]>([
    "Choir & Music Ministry",
    "Technical & Power Engineering",
    "Legal & Compliance",
    "Administration & HR",
  ]);
  const [customDept, setCustomDept] = useState("");

  // Step 3: Service Schedule & Arrival Policy
  const [serviceDays, setServiceDays] = useState<number[]>([0, 3]); // Sunday and Wednesday
  const [arrivalCutoff, setArrivalCutoff] = useState("07:30");
  const [lateTolerance, setLateTolerance] = useState("07:45");
  const [syncCutoff, setSyncCutoff] = useState("12:00");
  const [initialCoords, setInitialCoords] = useState<{
    lat: number;
    lng: number;
  }>({
    lat: 4.975,
    lng: 8.3417,
  });

  // Real-time regex and attendance window order validation
  const timeValidation = validateAttendanceWindow(
    arrivalCutoff,
    lateTolerance,
    syncCutoff,
  );

  // Real-time regex validation across Step 1 form fields
  const orgNameValidation = churchName ? validateOrgName(churchName) : { isValid: true, error: null };
  const branchValidation = branchName ? validateBranchName(branchName) : { isValid: true, error: null };
  const codeValidation = churchCode ? validateChurchCode(churchCode) : { isValid: true, error: null };
  const adminNameValidation = adminName ? validatePersonName(adminName) : { isValid: true, error: null };
  const phoneValidation = adminPhone ? validatePhoneNumber(adminPhone) : { isValid: true, error: null };

  // Helper to generate dynamic, unique organization code (XX-XXX-XXX format)
  const generateUniqueChurchCode = (
    org: string,
    cityVal?: string,
    stateVal?: string,
  ): string => {
    const cleanOrg = org.trim().replace(/[^a-zA-Z0-9\s]/g, "");
    let prefix = "ORG";
    if (cleanOrg) {
      const words = cleanOrg.split(/\s+/).filter(Boolean);
      if (words.length >= 2) {
        prefix = (words[0][0] + words[1][0]).toUpperCase();
      } else if (words.length === 1) {
        prefix = words[0].slice(0, 2).toUpperCase();
      }
    }
    if (prefix.length < 2) {
      prefix = (prefix + "X").slice(0, 2);
    }

    let locStr = (cityVal || stateVal || "").trim().replace(/[^a-zA-Z0-9\s]/g, "");
    let middle = "HQ0";
    if (locStr) {
      const locWords = locStr.split(/\s+/).filter(Boolean);
      if (locWords.length >= 3) {
        middle = locWords.slice(0, 3).map((w) => w[0].toUpperCase()).join("");
      } else if (locWords.length === 2) {
        middle = (locWords[0].slice(0, 2) + locWords[1][0]).toUpperCase();
      } else if (locWords.length === 1) {
        middle = locWords[0].slice(0, 3).toUpperCase();
      }
    }
    if (middle.length < 3) {
      middle = (middle + "HQ").slice(0, 3);
    }

    const randomPin = Math.floor(100 + Math.random() * 900);
    return `${prefix}-${middle}-${randomPin}`;
  };

  const handleRegenerateCode = () => {
    const code = generateUniqueChurchCode(churchName, city, state);
    setChurchCode(code);
    toast.info(`Generated new unique organization code: ${code}`);
  };

  const handleCopyCode = () => {
    if (!churchCode) return;
    navigator.clipboard.writeText(churchCode);
    toast.success(`Copied "${churchCode}" to clipboard!`);
  };

  // Handlers for organization name and location fields
  const handleChurchNameChange = (val: string) => {
    setChurchName(val);
    if (!churchCode || churchCode.startsWith("ORG-") || churchCode.includes("-HQ")) {
      setChurchCode(generateUniqueChurchCode(val, city, state));
    }
  };

  const handleCountryChange = (newCountry: string) => {
    setCountry(newCountry);
    const newState = newCountry === "Nigeria" ? state : "";
    if (newCountry !== "Nigeria") {
      setState("");
    }
    const fullBranch = [city.trim(), newState.trim(), newCountry.trim()]
      .filter(Boolean)
      .join(", ");
    setBranchName(fullBranch);

    if (!churchCode || churchCode.startsWith("ORG-") || churchCode.includes("-HQ")) {
      setChurchCode(generateUniqueChurchCode(churchName, city, newState));
    }
  };

  const handleStateChange = (newState: string) => {
    setState(newState);
    const fullBranch = [city.trim(), newState.trim(), country.trim()]
      .filter(Boolean)
      .join(", ");
    setBranchName(fullBranch);

    if (newState && DEFAULT_STATE_COORDS[newState]) {
      setInitialCoords(DEFAULT_STATE_COORDS[newState]);
    }

    if (!churchCode || churchCode.startsWith("ORG-") || churchCode.includes("-HQ")) {
      setChurchCode(generateUniqueChurchCode(churchName, city, newState));
    }
  };

  const handleCityChange = (newCity: string) => {
    setCity(newCity);
    const fullBranch = [newCity.trim(), state.trim(), country.trim()]
      .filter(Boolean)
      .join(", ");
    setBranchName(fullBranch);

    if (!churchCode || churchCode.startsWith("ORG-") || churchCode.includes("-HQ")) {
      setChurchCode(generateUniqueChurchCode(churchName, newCity, state));
    }
  };

  const handleAddPresetDept = (dept: string) => {
    if (!departments.includes(dept)) {
      setDepartments([...departments, dept]);
      toast.info(`Added "${dept}" to ministries.`);
    }
  };

  const handleAddCustomDept = () => {
    const trimmed = customDept.trim();
    if (!trimmed) return;
    const deptVal = validateDeptName(trimmed);
    if (!deptVal.isValid) {
      toast.error(deptVal.error);
      return;
    }
    if (departments.some((d) => d.toLowerCase() === trimmed.toLowerCase())) {
      toast.warn("This department already exists in your registry.");
      return;
    }
    setDepartments([...departments, trimmed]);
    setCustomDept("");
    toast.success(`Added "${trimmed}" to departments.`);
  };

  const handleRemoveDept = (dept: string) => {
    if (departments.length <= 1) {
      toast.warn("At least one department is required.");
      return;
    }
    setDepartments(departments.filter((d) => d !== dept));
  };

  const toggleDay = (dayId: number) => {
    if (serviceDays.includes(dayId)) {
      if (serviceDays.length === 1) {
        toast.warn("At least one service day is required.");
        return;
      }
      setServiceDays(serviceDays.filter((d) => d !== dayId));
    } else {
      setServiceDays([...serviceDays, dayId].sort());
    }
  };

  const validateStep = (step: number): boolean => {
    if (step === 1) {
      const orgVal = validateOrgName(churchName);
      if (!orgVal.isValid) {
        toast.error(orgVal.error);
        return false;
      }
      if (!country.trim()) {
        toast.error("Please select a country.");
        return false;
      }
      if (!state.trim()) {
        toast.error("Please select or enter a state / region.");
        return false;
      }
      if (!city.trim()) {
        toast.error("Please enter a city or branch premises area.");
        return false;
      }
      const branchVal = validateBranchName(branchName);
      if (!branchVal.isValid) {
        toast.error(branchVal.error);
        return false;
      }
      const codeVal = validateChurchCode(churchCode);
      if (!codeVal.isValid) {
        toast.error(codeVal.error);
        return false;
      }
      const nameVal = validatePersonName(adminName);
      if (!nameVal.isValid) {
        toast.error(nameVal.error);
        return false;
      }
      const phoneVal = validatePhoneNumber(adminPhone);
      if (!phoneVal.isValid) {
        toast.error(phoneVal.error);
        return false;
      }
    }
    if (step === 2) {
      if (departments.length === 0) {
        toast.error("Please select or add at least one ministry department.");
        return false;
      }
    }
    if (step === 3) {
      if (serviceDays.length === 0) {
        toast.error("Please select at least one active service day.");
        return false;
      }
      if (!timeValidation.isOpenValidFormat) {
        toast.error("Sign-In Window Open Time must be in valid HH:mm format.");
        return false;
      }
      if (!timeValidation.isCloseValidFormat) {
        toast.error("Sign-In Window Close Time must be in valid HH:mm format.");
        return false;
      }
      if (!timeValidation.isSyncValidFormat) {
        toast.error("Daily Cloud Sync Cutoff must be in valid HH:mm format.");
        return false;
      }
      if (!timeValidation.isOrderValid) {
        toast.error(
          timeValidation.errorMessage ||
            "The Sign-In Window Close Time must be later than the Sign-In Window Open Time.",
        );
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 3));
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleFinalSubmit = async () => {
    if (!validateStep(3)) return;
    if (!timeValidation.isValid) {
      toast.error(
        timeValidation.errorMessage ||
          "Please correct the sign-in window times.",
      );
      return;
    }

    setSubmitting(true);
    try {
      await createChurchWorkspace({
        churchName: churchName.trim(),
        branchName: branchName.trim(),
        churchCode: churchCode.trim().toUpperCase(),
        adminName: adminName.trim(),
        adminEmail: user?.email || "",
        adminPhone: adminPhone.trim(),
        departments,
        beaconConfig: {
          ssidHint: "",
          targetBssid: "",
        },
        geoFallback: {
          latitude: initialCoords.lat,
          longitude: initialCoords.lng,
          radiusMeters: 0,
          isConfigured: false,
        },
        policySettings: {
          serviceDays,
          arrivalCutoff,
          lateTolerance,
          syncCutoff,
        },
      });

      toast.success(
        "Assembly workspace successfully provisioned! Launching dashboard...",
      );
      setTimeout(() => {
        navigate("/dashboard");
      }, 600);
    } catch (err: unknown) {
      if (err instanceof Error) {
        toast.error(err.message);
      } else {
        toast.error("Failed to create assembly workspace.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || church) {
    return (
      <div
        className={styles.onboardingRoot}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            color: "#64748B",
            fontSize: "0.95rem",
            fontWeight: 500,
          }}
        >
          <Loader2 className={styles.spinner} size={22} />
          <span>Verifying workspace credentials...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.onboardingRoot}>
      {/* Top Header */}
      <header className={styles.onboardingHeader}>
        <div className={styles.brandCluster}>
          <img
            src="/image/app-icon.png"
            alt="Presenti"
            style={{ width: 38, height: 38, borderRadius: 10, objectFit: 'cover' }}
          />
          <div>
            <div className={styles.brandName}>Presenti</div>
            <div className={styles.brandBadge}>Branch Setup Wizard</div>
          </div>
        </div>

        {user && (
          <div className={styles.userBadge}>
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt="Admin"
                className={styles.userAvatar}
              />
            ) : (
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  backgroundColor: "#2563EB",
                  color: "#FFFFFF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                }}
              >
                {user.displayName?.[0] || "A"}
              </div>
            )}
            <span style={{ fontWeight: 600, color: "#0F172A" }}>
              {user.displayName || user.email}
            </span>
          </div>
        )}
      </header>

      {/* Main Container */}
      <main className={styles.mainContent}>
        {/* Stepper Bar */}
        <div className={styles.stepperContainer}>
          <div className={styles.stepperTrack}>
            <button
              type="button"
              onClick={() => currentStep > 1 && setCurrentStep(1)}
              className={`${styles.stepItem} ${currentStep === 1 ? styles.stepItemActive : ""} ${currentStep > 1 ? styles.stepItemComplete : ""}`}
            >
              <div className={styles.stepNumber}>
                {currentStep > 1 ? <Check size={16} /> : 1}
              </div>
              <div className={styles.stepTitles}>
                <span className={styles.stepLabel}>Step 1</span>
                <span className={styles.stepName}>Organization Identity</span>
              </div>
            </button>

            <button
              type="button"
              onClick={() => currentStep > 2 && setCurrentStep(2)}
              className={`${styles.stepItem} ${currentStep === 2 ? styles.stepItemActive : ""} ${currentStep > 2 ? styles.stepItemComplete : ""}`}
            >
              <div className={styles.stepNumber}>
                {currentStep > 2 ? <Check size={16} /> : 2}
              </div>
              <div className={styles.stepTitles}>
                <span className={styles.stepLabel}>Step 2</span>
                <span className={styles.stepName}>Workforce Units</span>
              </div>
            </button>

            <button
              type="button"
              className={`${styles.stepItem} ${currentStep === 3 ? styles.stepItemActive : ""}`}
            >
              <div className={styles.stepNumber}>3</div>
              <div className={styles.stepTitles}>
                <span className={styles.stepLabel}>Step 3</span>
                <span className={styles.stepName}>Arrival Policy</span>
              </div>
            </button>
          </div>
        </div>

        {/* Step 1: Organization Profile & Administrator */}
        {currentStep === 1 && (
          <div className={styles.wizardCard}>
            <div className={styles.wizardHeader}>
              <h2 className={styles.wizardTitle}>Organization Profile</h2>
              <p className={styles.wizardSubtitle}>
                Configure organization details and primary administrator
                profile.
              </p>
            </div>

            <div className={styles.formSection}>
              <div className={styles.sectionTitle}>Organization Details</div>
              <div className={styles.inputsGrid}>
                <div className={`${styles.fieldGroup} ${styles.fullWidth}`}>
                  <label htmlFor="churchName">
                    Organization / Company Name *
                  </label>
                  <input
                    id="churchName"
                    type="text"
                    placeholder="e.g. Acme Corporation or Apex Technologies"
                    value={churchName}
                    onChange={(e) => handleChurchNameChange(e.target.value)}
                    className={!orgNameValidation.isValid ? styles.inputError : ""}
                    required
                  />
                  {!orgNameValidation.isValid && (
                    <span className={styles.fieldErrorText}>
                      <AlertCircle size={12} /> {orgNameValidation.error}
                    </span>
                  )}
                </div>

                <div className={`${styles.fieldGroup} ${styles.fullWidth}`}>
                  <label>Premises Location (Country, State & City) *</label>
                  <div className={styles.locationGrid}>
                    <div className={styles.fieldGroup}>
                      <span className={styles.subFieldLabel}>Country *</span>
                      <div className={styles.inputIconWrapper}>
                        <Globe size={16} />
                        <select
                          id="country"
                          value={country}
                          onChange={(e) => handleCountryChange(e.target.value)}
                          required
                        >
                          {COUNTRIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className={styles.fieldGroup}>
                      <span className={styles.subFieldLabel}>State / Region *</span>
                      <div className={styles.inputIconWrapper}>
                        <MapPin size={16} />
                        {country === "Nigeria" ? (
                          <select
                            id="state"
                            value={state}
                            onChange={(e) => handleStateChange(e.target.value)}
                            className={!state ? styles.placeholderSelect : ""}
                            required
                          >
                            <option value="">Select State</option>
                            {NIGERIA_STATES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            id="state"
                            type="text"
                            placeholder="e.g. California"
                            value={state}
                            onChange={(e) => handleStateChange(e.target.value)}
                            required
                          />
                        )}
                      </div>
                    </div>

                    <div className={styles.fieldGroup}>
                      <span className={styles.subFieldLabel}>City / Area *</span>
                      <div className={styles.inputIconWrapper}>
                        <MapPin size={16} />
                        <input
                          id="city"
                          type="text"
                          placeholder="e.g. Calabar"
                          value={city}
                          onChange={(e) => handleCityChange(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {branchName ? (
                    <div className={styles.resolvedLocationPill}>
                      <CheckCircle2 size={13} color="#059669" />
                      <span>Premises Location: <strong>{branchName}</strong></span>
                    </div>
                  ) : null}
                  {!branchValidation.isValid && branchName && (
                    <span className={styles.fieldErrorText}>
                      <AlertCircle size={12} /> {branchValidation.error}
                    </span>
                  )}
                </div>

                <div className={`${styles.fieldGroup} ${styles.fullWidth}`}>
                  <label htmlFor="churchCode">Unique Organization Code *</label>
                  <div className={styles.codeActionGroup}>
                    <input
                      id="churchCode"
                      type="text"
                      className={`mono ${!codeValidation.isValid ? styles.inputError : ""}`}
                      placeholder="e.g. AC-LAG-482"
                      value={churchCode}
                      onChange={(e) =>
                        setChurchCode(e.target.value.toUpperCase())
                      }
                      required
                    />
                    <button
                      type="button"
                      onClick={handleRegenerateCode}
                      className={styles.codeGenBtn}
                      title="Generate new random code"
                    >
                      <RefreshCw size={13} />
                      <span>Regenerate</span>
                    </button>
                    {churchCode && (
                      <button
                        type="button"
                        onClick={handleCopyCode}
                        className={styles.codeGenBtn}
                        title="Copy code to clipboard"
                      >
                        <Copy size={13} />
                        <span>Copy</span>
                      </button>
                    )}
                  </div>
                  {!codeValidation.isValid && (
                    <span className={styles.fieldErrorText}>
                      <AlertCircle size={12} /> {codeValidation.error}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.formSection}>
              <div className={styles.sectionTitle}>Administrator Contact</div>
              <div className={styles.inputsGrid}>
                <div className={styles.fieldGroup}>
                  <label htmlFor="adminName">Full Name *</label>
                  <div className={styles.inputIconWrapper}>
                    <User size={16} />
                    <input
                      id="adminName"
                      type="text"
                      placeholder="e.g. John Doe"
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      className={!adminNameValidation.isValid ? styles.inputError : ""}
                      required
                    />
                  </div>
                  {!adminNameValidation.isValid && (
                    <span className={styles.fieldErrorText}>
                      <AlertCircle size={12} /> {adminNameValidation.error}
                    </span>
                  )}
                </div>

                <div className={styles.fieldGroup}>
                  <label htmlFor="adminPhone">Contact Phone Number *</label>
                  <div className={styles.inputIconWrapper}>
                    <Phone size={16} />
                    <input
                      id="adminPhone"
                      type="tel"
                      placeholder="e.g. +234 803 123 4567"
                      value={adminPhone}
                      onChange={(e) => setAdminPhone(e.target.value)}
                      className={!phoneValidation.isValid ? styles.inputError : ""}
                      required
                    />
                  </div>
                  {!phoneValidation.isValid && (
                    <span className={styles.fieldErrorText}>
                      <AlertCircle size={12} /> {phoneValidation.error}
                    </span>
                  )}
                </div>

                <div className={`${styles.fieldGroup} ${styles.fullWidth}`}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 2,
                    }}
                  >
                    <label htmlFor="adminEmail">Administrator Email</label>
                    <span className={styles.verifiedPill}>
                      <CheckCircle2 size={11} /> Google Verified
                    </span>
                  </div>
                  <div className={styles.inputIconWrapper}>
                    <Mail size={16} />
                    <input
                      id="adminEmail"
                      type="email"
                      className={styles.readOnlyField}
                      value={user?.email || "Authenticated Google Account"}
                      readOnly
                      title="Authenticated Google account email"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Workforce Units */}
        {currentStep === 2 && (
          <div className={styles.wizardCard}>
            <div className={styles.wizardHeader}>
              <h2 className={styles.wizardTitle}>
                Workforce Departments & Units
              </h2>
              <p className={styles.wizardSubtitle}>
                Configure active departments and teams for your organization.
              </p>
            </div>

            <div className={styles.fieldGroup}>
              <label>Configured Units ({departments.length})</label>
              <div className={styles.selectedChipsContainer}>
                {departments.map((dept) => (
                  <span key={dept} className={styles.chipRemovable}>
                    <span>{dept}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveDept(dept)}
                      className={styles.chipRemoveBtn}
                      title="Remove"
                    >
                      <X size={13} />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Quick Presets */}
            <div className={styles.presetsSection}>
              <div className={styles.presetsTitle}>
                Quick Department Presets
              </div>
              <div className={styles.presetChips}>
                {DEPARTMENT_PRESETS.filter((p) => !departments.includes(p)).map(
                  (preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleAddPresetDept(preset)}
                      className={styles.presetChip}
                    >
                      <Plus size={13} />
                      <span>{preset}</span>
                    </button>
                  ),
                )}
              </div>
            </div>

            {/* Add Custom Dept */}
            <div className={styles.fieldGroup}>
              <label htmlFor="customDept">Add Custom Department</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  id="customDept"
                  type="text"
                  placeholder="e.g. Engineering, Operations, Marketing"
                  value={customDept}
                  onChange={(e) => setCustomDept(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddCustomDept();
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddCustomDept}
                  className="btn btn-secondary"
                >
                  <Plus size={16} />
                  <span>Add Unit</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Work Schedule & Arrival Policy */}
        {currentStep === 3 && (
          <div className={styles.wizardCard}>
            <div className={styles.wizardHeader}>
              <h2 className={styles.wizardTitle}>
                Work Schedule & Punctuality Policy
              </h2>
              <p className={styles.wizardSubtitle}>
                Configure official operating days and check-in cutoff times.
              </p>
            </div>

            <div className={styles.fieldGroup}>
              <label>Active Operating Days</label>
              <span className={styles.fieldHint}>
                Recurring days of the week when mobile attendance check-in gates
                automatically open.
              </span>
              <div className={styles.serviceDaysGrid}>
                {WEEK_DAYS.map((day) => {
                  const isSelected = serviceDays.includes(day.id);
                  return (
                    <button
                      key={day.id}
                      type="button"
                      onClick={() => toggleDay(day.id)}
                      className={`${styles.dayCard} ${isSelected ? styles.dayCardSelected : ""}`}
                    >
                      <span className={styles.dayCardName}>{day.name}</span>
                      <span className={styles.dayCardType}>
                        {isSelected ? "Active" : "Off"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={styles.inputsGrid}>
              <div className={styles.fieldGroup}>
                <label htmlFor="arrivalCutoff">
                  Sign-In Window Open Time *
                </label>
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
                    <AlertCircle size={12} /> Format must be HH:mm (e.g. 07:00
                    AM)
                  </span>
                ) : !timeValidation.isOrderValid ? (
                  <span className={styles.fieldErrorText}>
                    <AlertCircle size={12} /> Open time must be earlier than
                    close time ({timeValidation.formattedClose})
                  </span>
                ) : (
                  <span className={styles.fieldHint}>
                    When check-in timer starts and becomes active on the mobile
                    app ({timeValidation.formattedOpen}).
                  </span>
                )}
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="lateTolerance">
                  Sign-In Window Close Time *
                </label>
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
                    <AlertCircle size={12} /> Format must be HH:mm (e.g. 07:30
                    AM)
                  </span>
                ) : !timeValidation.isOrderValid ? (
                  <span className={styles.fieldErrorText}>
                    <AlertCircle size={12} /> Close time must be later than open
                    time ({timeValidation.formattedOpen})
                  </span>
                ) : (
                  <span className={styles.fieldHint}>
                    When check-in officially closes (
                    {timeValidation.formattedClose}). Attendance registration
                    stops and the app locks — zero late tolerance.
                  </span>
                )}
              </div>

              <div className={`${styles.fieldGroup} ${styles.fullWidth}`}>
                <label htmlFor="syncCutoff">Daily Cloud Sync Cutoff *</label>
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
                    <AlertCircle size={12} /> Format must be HH:mm (e.g. 12:00
                    PM)
                  </span>
                ) : (
                  <span className={styles.fieldHint}>
                    Daily deadline when all locally saved registers must be
                    pushed to the cloud (e.g. 12:00 PM).
                  </span>
                )}
              </div>
            </div>

            {/* Immediate Real-Time Validation Alert Prompt */}
            {!timeValidation.isValid ? (
              <div className={styles.timeAlertError} role="alert">
                <AlertTriangle size={18} className={styles.timeAlertIcon} />
                <div className={styles.timeAlertContent}>
                  <strong>Invalid Time Window:</strong>{" "}
                  {timeValidation.errorMessage}
                </div>
              </div>
            ) : (
              <div className={styles.timeAlertSuccess}>
                <Clock size={18} className={styles.timeAlertIcon} />
                <div className={styles.timeAlertContent}>
                  <strong>Strict Check-In Window:</strong> Sign-in will be open
                  strictly between{" "}
                  <strong>{timeValidation.formattedOpen}</strong> and{" "}
                  <strong>{timeValidation.formattedClose}</strong> (
                  {formatDurationMinutes(timeValidation.durationMinutes)} active
                  window) on scheduled operating days. Once closed, check-in is
                  disabled — there is no late tolerance.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Wizard Footer Controls */}
        <div className={styles.wizardFooter}>
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              className="btn btn-secondary"
            >
              <ArrowLeft size={16} />
              <span>Back</span>
            </button>
          ) : (
            <div />
          )}

          {currentStep < 3 ? (
            <button
              type="button"
              onClick={handleNext}
              className="btn btn-primary"
            >
              <span>Continue to Step {currentStep + 1}</span>
              <ArrowRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinalSubmit}
              disabled={
                submitting || (currentStep === 3 && !timeValidation.isValid)
              }
              className="btn btn-primary"
              style={{
                backgroundColor:
                  currentStep === 3 && !timeValidation.isValid
                    ? "#94A3B8"
                    : "#059669",
                borderColor:
                  currentStep === 3 && !timeValidation.isValid
                    ? "#94A3B8"
                    : "#047857",
                cursor:
                  currentStep === 3 && !timeValidation.isValid
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              <CheckCircle2 size={16} />
              <span>
                {submitting
                  ? "Provisioning Workspace..."
                  : "Complete & Launch Organization Dashboard"}
              </span>
            </button>
          )}
        </div>
      </main>
    </div>
  );
};
