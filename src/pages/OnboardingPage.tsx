import React, { useState, useEffect, useRef } from "react";
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

export interface GeocodedLocation {
  id: string;
  name: string;
  sub: string;
  displayName: string;
  lat: number;
  lng: number;
}

// Live geocoding querying Photon (OpenStreetMap) and Open-Meteo in parallel
async function searchGlobalLocations(
  query: string,
): Promise<GeocodedLocation[]> {
  const clean = query.trim();
  if (clean.length < 2) return [];

  const results: GeocodedLocation[] = [];
  const seen = new Set<string>();

  const addLocation = (
    id: string,
    name: string,
    state?: string,
    country?: string,
    district?: string,
    lat?: number,
    lng?: number,
  ) => {
    if (typeof lat !== "number" || typeof lng !== "number" || !name) return;

    let cleanState = state || "";
    if (
      country === "Nigeria" &&
      cleanState &&
      !cleanState.toLowerCase().includes("state") &&
      !cleanState.toLowerCase().includes("fct")
    ) {
      cleanState = `${cleanState} State`;
    }

    const subList: string[] = [];
    if (district && district.toLowerCase() !== name.toLowerCase()) {
      subList.push(district);
    }
    if (cleanState) subList.push(cleanState);
    if (country) subList.push(country);

    const sub = subList.join(", ");
    const displayList = [name];
    if (cleanState && cleanState.toLowerCase() !== name.toLowerCase()) {
      displayList.push(cleanState);
    }
    if (country) displayList.push(country);
    const displayName = displayList.join(", ");

    const key = `${name.toLowerCase()}|${cleanState.toLowerCase()}|${country?.toLowerCase() || ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push({
        id,
        name,
        sub,
        displayName,
        lat: Number(lat.toFixed(5)),
        lng: Number(lng.toFixed(5)),
      });
    }
  };

  try {
    const [photonRes, meteoRes] = await Promise.allSettled([
      fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(clean)}&limit=10`,
      ).then((r) => (r.ok ? r.json() : null)),
      fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          clean,
        )}&count=10&language=en&format=json`,
      ).then((r) => (r.ok ? r.json() : null)),
    ]);

    if (
      photonRes.status === "fulfilled" &&
      photonRes.value &&
      Array.isArray(photonRes.value.features)
    ) {
      for (const f of photonRes.value.features) {
        const p = f.properties || {};
        const coords = f.geometry?.coordinates || [];
        const name = p.name || p.city || p.district || clean;
        addLocation(
          `ph-${p.osm_id || Math.random()}`,
          name,
          p.state,
          p.country,
          p.district || p.county,
          coords[1],
          coords[0],
        );
      }
    }

    if (
      meteoRes.status === "fulfilled" &&
      meteoRes.value &&
      Array.isArray(meteoRes.value.results)
    ) {
      for (const item of meteoRes.value.results) {
        addLocation(
          `om-${item.id}`,
          item.name,
          item.admin1,
          item.country,
          item.admin2,
          item.latitude,
          item.longitude,
        );
      }
    }
  } catch (err) {
    console.error("Geocoding lookup error:", err);
  }

  return results.slice(0, 8);
}

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
  const { user, createChurchWorkspace } = useAuth();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: Church Identity & Administrator Information
  const [churchName, setChurchName] = useState("");
  const [branchName, setBranchName] = useState("");
  const [churchCode, setChurchCode] = useState("");
  const [adminName, setAdminName] = useState(user?.displayName || "");
  const [adminPhone, setAdminPhone] = useState("");

  // Location Autosuggest State
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<
    GeocodedLocation[]
  >([]);
  const [isSearchingLocation, setIsSearchingLocation] = useState(false);
  const locationWrapperRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeSearchQueryRef = useRef<string>("");

  // Close location dropdown when clicking outside & cleanup timer
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        locationWrapperRef.current &&
        !locationWrapperRef.current.contains(e.target as Node)
      ) {
        setShowLocationDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

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

  // Helper to generate dynamic, unique church code
  const generateUniqueChurchCode = (org: string, loc: string): string => {
    let prefix = "CHURCH";
    const cleanOrg = org.trim();
    if (cleanOrg) {
      const words = cleanOrg.split(/\s+/).filter(Boolean);
      if (words.length >= 2) {
        prefix = words
          .slice(0, 3)
          .map((w) => w[0].toUpperCase())
          .join("");
      } else if (words.length === 1) {
        prefix = words[0].slice(0, 4).toUpperCase();
      }
    }

    let suffix = "HQ";
    const primaryCity = loc.split(",")[0].trim();
    if (primaryCity) {
      const branchWords = primaryCity.split(/\s+/).filter(Boolean);
      if (branchWords.length >= 2) {
        suffix = branchWords
          .slice(0, 2)
          .map((w) => w[0].toUpperCase())
          .join("");
      } else if (primaryCity.length >= 2) {
        suffix = primaryCity.slice(0, 3).toUpperCase();
      }
    }

    const randomPin = Math.floor(100 + Math.random() * 900);
    return `${prefix}-${suffix}-${randomPin}`;
  };

  const handleRegenerateCode = () => {
    const code = generateUniqueChurchCode(churchName, branchName);
    setChurchCode(code);
    toast.info(`Generated new unique church code: ${code}`);
  };

  const handleCopyCode = () => {
    if (!churchCode) return;
    navigator.clipboard.writeText(churchCode);
    toast.success(`Copied "${churchCode}" to clipboard!`);
  };

  // Auto-generate code when user inputs names if not yet set
  const handleChurchNameChange = (val: string) => {
    setChurchName(val);
    if (!churchCode) {
      setChurchCode(generateUniqueChurchCode(val, branchName));
    }
  };

  const handleBranchNameChange = (val: string) => {
    setBranchName(val);
    if (!churchCode) {
      setChurchCode(generateUniqueChurchCode(churchName, val));
    }

    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    const query = val.trim();
    activeSearchQueryRef.current = query;

    if (query.length < 2) {
      setLocationSuggestions([]);
      setShowLocationDropdown(false);
      setIsSearchingLocation(false);
      return;
    }

    setIsSearchingLocation(true);
    setShowLocationDropdown(true);

    searchTimerRef.current = setTimeout(async () => {
      const results = await searchGlobalLocations(query);
      if (activeSearchQueryRef.current === query) {
        setLocationSuggestions(results);
        setIsSearchingLocation(false);
        setShowLocationDropdown(true);
      }
    }, 280);
  };

  const handleSelectLocation = (loc: GeocodedLocation) => {
    setBranchName(loc.displayName);
    setShowLocationDropdown(false);
    setLocationSuggestions([]);

    // Update Church Code dynamically
    if (
      !churchCode ||
      churchCode.startsWith("CHURCH-") ||
      churchCode.includes("-HQ-")
    ) {
      setChurchCode(generateUniqueChurchCode(churchName, loc.name));
    }

    // Store initial location coordinates
    if (loc.lat && loc.lng) {
      setInitialCoords({ lat: loc.lat, lng: loc.lng });
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
          radiusMeters: 10,
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
                <div className={styles.fieldGroup}>
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

                <div className={styles.fieldGroup}>
                  <label htmlFor="branchName">Branch Location & State *</label>
                  <div
                    className={`${styles.inputIconWrapper} ${styles.autocompleteWrapper}`}
                    ref={locationWrapperRef}
                  >
                    <MapPin size={16} />
                    <input
                      id="branchName"
                      type="text"
                      placeholder="e.g. Calabar, Cross River State, Nigeria"
                      value={branchName}
                      onChange={(e) => handleBranchNameChange(e.target.value)}
                      onFocus={() => {
                        if (branchName.trim().length >= 2) {
                          setShowLocationDropdown(true);
                          if (locationSuggestions.length === 0) {
                            handleBranchNameChange(branchName);
                          }
                        }
                      }}
                      autoComplete="off"
                      className={!branchValidation.isValid ? styles.inputError : ""}
                      required
                    />

                    {showLocationDropdown && (
                      <div className={styles.suggestionsDropdown}>
                        {isSearchingLocation ? (
                          <div className={styles.suggestionSearching}>
                            <Loader2 size={16} className={styles.spinner} />
                            <span>Searching global locations...</span>
                          </div>
                        ) : locationSuggestions.length > 0 ? (
                          locationSuggestions.map((loc) => (
                            <button
                              key={loc.id}
                              type="button"
                              className={styles.suggestionItem}
                              onClick={() => handleSelectLocation(loc)}
                            >
                              <div className={styles.suggestionIconWrapper}>
                                <MapPin
                                  size={15}
                                  className={styles.suggestionIcon}
                                />
                              </div>
                              <div className={styles.suggestionDetails}>
                                <span className={styles.suggestionMain}>
                                  {loc.name}
                                </span>
                                {loc.sub && (
                                  <span className={styles.suggestionSub}>
                                    {loc.sub}
                                  </span>
                                )}
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className={styles.suggestionEmpty}>
                            No matching locations found for "{branchName.trim()}
                            "
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {!branchValidation.isValid && (
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
                      placeholder="e.g. ACME-HQ"
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
