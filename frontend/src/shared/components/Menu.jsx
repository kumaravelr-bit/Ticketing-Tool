/* eslint-disable import/first */
import { Link } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { getAuthItem, getAuthUser, logout } from "../../utils/auth";
import { Button } from "@mui/material";
import { toast } from "react-toastify";
import api from "../../services/api";
import styles from "../../css/shared/Menu.module.css";
import { useTheme } from "../../layouts/ThemeContext";
import { resolveAssetUrl } from "../../config/apiConfig";
import {
  FaIdBadge,
  FaTicketAlt,
  FaSignOutAlt,
  FaClipboardList,
  FaHandshake,
  FaUserCircle,
  FaBars,
  FaTimes,
  FaChevronDown,
} from "react-icons/fa";

function EyeIcon({ off = false }) {
  if (off) {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
        <path
          d="M3 3l18 18M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58M9.88 5.09A10.94 10.94 0 0112 5c5 0 9.27 3.11 11 7-0.61 1.37-1.54 2.63-2.72 3.71M6.1 6.1C3.91 7.43 2.18 9.47 1 12c1.73 3.89 6 7 11 7 1.55 0 3.03-.3 4.38-.84"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        d="M1 12c1.73-3.89 6-7 11-7s9.27 3.11 11 7c-1.73 3.89-6 7-11 7S2.73 15.89 1 12z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function DarkModeToggle() {
  const { isDark, toggleTheme } = useTheme();

  return (
    <label
      className={styles.switch}
      title={isDark ? "Switch to Light" : "Switch to Dark"}
    >
      <input
        type="checkbox"
        checked={isDark}
        onChange={toggleTheme}
        className={styles.switchInput}
      />
      <div className={`${styles.slider} ${styles.round}`}>
        <div className={styles.sunMoon}>
          <svg id={styles.moonDot1} className={styles.moonDot} viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" /></svg>
          <svg id={styles.moonDot2} className={styles.moonDot} viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" /></svg>
          <svg id={styles.moonDot3} className={styles.moonDot} viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" /></svg>
          <svg id={styles.lightRay1} className={styles.lightRay} viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" /></svg>
          <svg id={styles.lightRay2} className={styles.lightRay} viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" /></svg>
          <svg id={styles.lightRay3} className={styles.lightRay} viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" /></svg>
          <svg id={styles.cloud1} className={styles.cloudDark} viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" /></svg>
          <svg id={styles.cloud2} className={styles.cloudDark} viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" /></svg>
          <svg id={styles.cloud3} className={styles.cloudDark} viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" /></svg>
          <svg id={styles.cloud4} className={styles.cloudLight} viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" /></svg>
          <svg id={styles.cloud5} className={styles.cloudLight} viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" /></svg>
          <svg id={styles.cloud6} className={styles.cloudLight} viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" /></svg>
        </div>
        <div className={styles.stars}>
          <svg id={styles.star1} className={styles.star} viewBox="0 0 20 20"><path d="M 0 10 C 10 10,10 10 ,0 10 C 10 10 , 10 10 , 10 20 C 10 10 , 10 10 , 20 10 C 10 10 , 10 10 , 10 0 C 10 10,10 10 ,0 10 Z" /></svg>
          <svg id={styles.star2} className={styles.star} viewBox="0 0 20 20"><path d="M 0 10 C 10 10,10 10 ,0 10 C 10 10 , 10 10 , 10 20 C 10 10 , 10 10 , 20 10 C 10 10 , 10 10 , 10 0 C 10 10,10 10 ,0 10 Z" /></svg>
          <svg id={styles.star3} className={styles.star} viewBox="0 0 20 20"><path d="M 0 10 C 10 10,10 10 ,0 10 C 10 10 , 10 10 , 10 20 C 10 10 , 10 10 , 20 10 C 10 10 , 10 10 , 10 0 C 10 10,10 10 ,0 10 Z" /></svg>
          <svg id={styles.star4} className={styles.star} viewBox="0 0 20 20"><path d="M 0 10 C 10 10,10 10 ,0 10 C 10 10 , 10 10 , 10 20 C 10 10 , 10 10 , 20 10 C 10 10 , 10 10 , 10 0 C 10 10,10 10 ,0 10 Z" /></svg>
        </div>
      </div>
    </label>
  );
}

function MobileGroup({ icon, label, isOpen, onToggle, children }) {
  return (
    <div className={styles.mobileMenuGroup}>
      <div className={styles.mobileMenuTitle} onClick={onToggle}>
        <span className={styles.mobileIcon}>{icon}</span>
        <span>{label}</span>
        <FaChevronDown
          className={`${styles.mobileArrow} ${isOpen ? styles.mobileArrowOpen : ""}`}
        />
      </div>
      {isOpen && <div className={styles.mobileSubMenu}>{children}</div>}
    </div>
  );
}

function DesktopGroup({ icon, label, isOpen, collapsed, onToggle, children }) {
  return (
    <div className={styles.menuGroup}>
      <div className={styles.menuTitle} onClick={onToggle}>
        {icon}
        {!collapsed && <span>{label}</span>}
        {!collapsed && (
          <FaChevronDown
            className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`}
          />
        )}
      </div>
      {isOpen && !collapsed && <div className={styles.subMenu}>{children}</div>}
    </div>
  );
}

function ProfileModal({
  open,
  onClose,
  userName,
  userEmpId,
  userTeam,
  userDesignation,
  userPhoto,
  userInitial,
  isDark,
  canViewAdminProfileActions,
}) {
  const [photoVisible, setPhotoVisible] = useState(Boolean(userPhoto));

  const [showPasswordPanel, setShowPasswordPanel] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isCurrentPasswordVerified, setIsCurrentPasswordVerified] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setShowPasswordPanel(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setIsCurrentPasswordVerified(false);
      setVerifyLoading(false);
      setPasswordLoading(false);
    }
  }, [open]);

  useEffect(() => {
    setPhotoVisible(Boolean(userPhoto));
  }, [userPhoto]);

  if (!open) return null;

  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;
  const canSubmitPassword =
    isCurrentPasswordVerified &&
    newPassword.length >= 6 &&
    confirmPassword.length >= 6 &&
    passwordsMatch &&
    !passwordLoading;

  const resetPasswordForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setIsCurrentPasswordVerified(false);
    setVerifyLoading(false);
    setPasswordLoading(false);
  };

  const togglePasswordPanel = () => {
    setShowPasswordPanel((prev) => {
      const next = !prev;
      if (!next) {
        resetPasswordForm();
      }
      return next;
    });
  };

  const handleVerifyCurrentPassword = async () => {
    if (!currentPassword || verifyLoading) return;

    try {
      setVerifyLoading(true);
      await api.post("/auth/verify-current-password", { currentPassword });
      setIsCurrentPasswordVerified(true);
      toast.success("Current password verified");
    } catch (error) {
      setIsCurrentPasswordVerified(false);
      toast.error(
        error.response?.data?.message ||
          "Incorrect current password. Use forgot password from login if needed."
      );
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!canSubmitPassword) return;

    try {
      setPasswordLoading(true);
      await api.post("/auth/change-password", {
        currentPassword,
        password: newPassword,
      });
      toast.success("Password updated successfully");
      resetPasswordForm();
      setShowPasswordPanel(false);
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to update password");
    } finally {
      setPasswordLoading(false);
    }
  };

  const openSupportPage = () => {
    window.open("/support/it-contact-matrix", "_blank", "noopener,noreferrer");
  };

  return (
    <div className={styles.profileOverlay} onClick={onClose}>
      <div className={styles.profileModal} onClick={(e) => e.stopPropagation()}>
        <button
          className={styles.profileClose}
          onClick={onClose}
          aria-label="Close profile"
        >
          <FaTimes />
        </button>

        <div className={styles.profileLayout}>
          <div className={styles.profilePrimaryPanel}>
            <div className={styles.profileHero}>
              <div className={styles.profileAvatarWrap}>
                {photoVisible && userPhoto ? (
                  <img
                    src={userPhoto}
                    alt={userName || "User"}
                    className={styles.profileAvatar}
                    onError={() => setPhotoVisible(false)}
                  />
                ) : (
                  <div className={styles.profileFallback}>{userInitial}</div>
                )}
              </div>

              <div className={styles.profileHeroText}>
                <p className={styles.profileEyebrow}>Logged In User</p>
                <h3 className={styles.profileName}>{userName || "User"}</h3>
                <p className={styles.profileEmpId}>{userEmpId || "-"}</p>
              </div>
            </div>

            <div className={styles.profileInfoStack}>
              <div className={styles.profileInfoCard}>
                <span className={styles.profileInfoLabel}>EMP ID</span>
                <span className={styles.profileInfoValue}>{userEmpId || "-"}</span>
              </div>
              <div className={styles.profileInfoCard}>
                <span className={styles.profileInfoLabel}>Team</span>
                <span className={styles.profileInfoValue}>{userTeam || "-"}</span>
              </div>
              <div className={styles.profileInfoCard}>
                <span className={styles.profileInfoLabel}>Designation</span>
                <span className={styles.profileInfoValue}>{userDesignation || "-"}</span>
              </div>
            </div>

            {canViewAdminProfileActions && (
              <div className={styles.profileSideUtilities}>
                <div className={styles.profileMiniCard}>
                  <div className={styles.profileMiniHeader}>
                    <div className={styles.profileMiniText}>
                      <span className={styles.profileActionTitle}>Appearance</span>
                      <p className={styles.profileMiniDescription}>
                        {isDark ? "Dark mode enabled" : "Light mode enabled"}
                      </p>
                    </div>
                    <DarkModeToggle />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className={styles.profileSecondaryPanel}>
            <div className={styles.profilePasswordCard}>
              <div className={styles.profileActionHeader}>
                <div className={styles.profileActionText}>
                  <span className={styles.profileActionTitle}>Change Password</span>
                  <p className={styles.passwordLead}>
                    Verify your existing password before setting a new one.
                  </p>
                </div>
                <button
                  type="button"
                  className={styles.profileInlineButton}
                  onClick={togglePasswordPanel}
                >
                  {showPasswordPanel ? "Hide" : "Change"}
                </button>
              </div>

              {!showPasswordPanel ? (
                <div className={styles.passwordCollapsedState}>
                  <span className={styles.passwordCollapsedLabel}>
                    Open this tab to update your password securely.
                  </span>
                </div>
              ) : (
                <div className={styles.passwordPanel}>
                  <div className={styles.passwordField}>
                    <label className={styles.passwordLabel} htmlFor="profile-current-password">
                      Existing Password
                    </label>
                    <div className={styles.passwordInputWrap}>
                      <input
                        id="profile-current-password"
                        className={styles.passwordInput}
                        type={showCurrentPassword ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => {
                          setCurrentPassword(e.target.value);
                          if (isCurrentPasswordVerified) {
                            setIsCurrentPasswordVerified(false);
                            setNewPassword("");
                            setConfirmPassword("");
                          }
                        }}
                        placeholder="Enter existing password"
                      />
                      <button
                        type="button"
                        className={styles.passwordToggle}
                        onClick={() => setShowCurrentPassword((prev) => !prev)}
                        aria-label={showCurrentPassword ? "Hide existing password" : "Show existing password"}
                      >
                        <EyeIcon off={showCurrentPassword} />
                      </button>
                    </div>
                  </div>

                  {!isCurrentPasswordVerified ? (
                    <>
                      <p className={styles.passwordHint}>
                        If your current password is incorrect, use the forgot password option on the login page.
                      </p>
                      <button
                        type="button"
                        className={styles.passwordSubmit}
                        onClick={handleVerifyCurrentPassword}
                        disabled={!currentPassword || verifyLoading}
                      >
                        {verifyLoading ? "Verifying..." : "Verify Password"}
                      </button>
                    </>
                  ) : (
                    <>
                      <p className={styles.passwordHintSuccess}>
                        Existing password verified. You can set a new password now.
                      </p>

                      <div className={styles.passwordFieldsGrid}>
                        <div className={styles.passwordField}>
                          <label className={styles.passwordLabel} htmlFor="profile-new-password">
                            New Password
                          </label>
                          <div className={styles.passwordInputWrap}>
                            <input
                              id="profile-new-password"
                              className={styles.passwordInput}
                              type={showNewPassword ? "text" : "password"}
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="Enter new password"
                            />
                            <button
                              type="button"
                              className={styles.passwordToggle}
                              onClick={() => setShowNewPassword((prev) => !prev)}
                              aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                            >
                              <EyeIcon off={showNewPassword} />
                            </button>
                          </div>
                        </div>

                        <div className={styles.passwordField}>
                          <label className={styles.passwordLabel} htmlFor="profile-confirm-password">
                            Confirm Password
                          </label>
                          <div className={styles.passwordInputWrap}>
                            <input
                              id="profile-confirm-password"
                              className={styles.passwordInput}
                              type={showConfirmPassword ? "text" : "password"}
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              placeholder="Confirm password"
                            />
                            <button
                              type="button"
                              className={styles.passwordToggle}
                              onClick={() => setShowConfirmPassword((prev) => !prev)}
                              aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                            >
                              <EyeIcon off={showConfirmPassword} />
                            </button>
                          </div>
                        </div>
                      </div>

                      {confirmPassword && !passwordsMatch && (
                        <p className={styles.passwordHintError}>Passwords do not match.</p>
                      )}
                      {newPassword && newPassword.length < 6 && (
                        <p className={styles.passwordHint}>Password must be at least 6 characters.</p>
                      )}

                      <button
                        type="button"
                        className={styles.passwordSubmit}
                        onClick={handleChangePassword}
                        disabled={!canSubmitPassword}
                      >
                        {passwordLoading ? "Updating..." : "Update Password"}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {canViewAdminProfileActions && (
              <div className={styles.profileMiniCard}>
                <div className={styles.profileMiniHeader}>
                  <div className={styles.profileMiniText}>
                    <span className={styles.profileActionTitle}>Contact Support</span>
                    <p className={styles.profileMiniDescription}>
                      Need help with access or profile issues? Reach the support team.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.profileSupportButton}
                  onClick={openSupportPage}
                >
                  Contact @Developer_Team
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Menu({ collapsed, setCollapsed }) {
  const { isDark } = useTheme();
  const [internalCollapsed, setInternalCollapsed] = useState(true);
  const isControlled = collapsed !== undefined && setCollapsed !== undefined;
  const currentCollapsed = isControlled ? collapsed : internalCollapsed;
  const updateCollapsed = isControlled ? setCollapsed : setInternalCollapsed;
  const sidebarRef = useRef(null);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) {
        setIsMobileMenuOpen(false);
        updateCollapsed(true);
      }
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [updateCollapsed]);

  const role = getAuthItem("role")?.toString().trim().toUpperCase() || "";
  const team = getAuthItem("team")?.toString().trim().toUpperCase() || "";

  const savedUser = (() => {
    try {
      return getAuthUser() || {};
    } catch {
      return {};
    }
  })();

  const userName = savedUser?.name || "";
  const userEmpId = savedUser?.emp_id || savedUser?.employee_id || getAuthItem("emp_id") || "";
  const userTeam = savedUser?.team_name || savedUser?.team || getAuthItem("team") || "";
  const userDesignation =
    savedUser?.designation_name ||
    savedUser?.designation ||
    getAuthItem("designation_name") ||
    getAuthItem("designation") ||
    "";
  const designation = userDesignation.toString().trim().toUpperCase();
  const userPhoto = resolveAssetUrl(savedUser?.profile_photo, "uploads/profile");
  const userInitial = (userName || "U").trim().charAt(0).toUpperCase();

  const isAdmin = role === "SUPER_ADMIN" || role === "ADMIN";
  const isITorCRMAdmin = role === "IT_ADMIN" || role === "CRM_ADMIN";
  const canManageEmployees = isAdmin || isITorCRMAdmin;

  const canViewOfferLetter =
    isAdmin ||
    (role === "USER_ACCOUNT" && (team === "HRD" || team === "MANAGEMENT"));
  const canViewPayslip =
    isAdmin || role === "USER_ACCOUNT";
  const canViewRelieving =
    isAdmin ||
    (role === "USER_ACCOUNT" &&
      team === "HRD" &&
      ["MANAGER", "RECRUITER", "RECRUTIER", "ADMIN"].includes(designation));

  const technicalManpowerDesignations = new Set([
    "ASST BRANCH INCHARGE",
    "BRANCH INCHARGE",
    "ASST TECH LEAD",
    "TECH LEAD",
    "CTO",
  ]);

  const salesManpowerDesignations = new Set([
    "ASM",
    "MIS",
    "MIS EXECUTIVE",
    "VENDOR COORDINATOR",
    "VENDOR SALES",
    "SERVICE SUPPORT",
    "CMO",
    "SALES HEAD",
  ]);

  const managementManpowerDesignations = new Set(["CEO", "MD"]);
  const hoManpowerDesignations = new Set(["ASST MANAGER", "MANAGER"]);
  const headOfficeTeams = new Set([
    "ACCOUNTS", "IT", "HRD", "CUSTOMER CARE", "STORE",
    "DESIGNER", "NOC", "TECHOPS", "SERVICE VENDOR", "RETENSION",
    "PURCHASE", "VAS", "ONM", "PROJECT", "MARKETING", "OPERATIONS",
    "SUPPORT", "ADMIN", "COLLECTION", "PROCUREMENT",
    "FEASIBILITY", "QUALITY", "TRAINING", "COMPLIANCE", "FINANCE",
  ]);

  const canViewManpower =
    isAdmin ||
    team === "HRD" ||
    (headOfficeTeams.has(team) && hoManpowerDesignations.has(designation)) ||
    (team === "TECHNICAL" && technicalManpowerDesignations.has(designation)) ||
    (team === "SALES" && salesManpowerDesignations.has(designation)) ||
    (team === "MANAGEMENT" && managementManpowerDesignations.has(designation));

  const [open, setOpen] = useState({
    employees: false,
    ticketing: false,
    hrd: false,
    onboarding: false,
  });

  useEffect(() => {
    if (isMobile || currentCollapsed) return undefined;

    const handlePointerDown = (event) => {
      if (!sidebarRef.current?.contains(event.target)) {
        updateCollapsed(true);
        setOpen({
          employees: false,
          ticketing: false,
          hrd: false,
          onboarding: false,
        });
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [currentCollapsed, isMobile, updateCollapsed]);

  const handleToggle = (key) => {
    if (currentCollapsed) updateCollapsed(false);
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleMobileMenu = () => setIsMobileMenuOpen((v) => !v);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);
  const closeProfileModal = () => setProfileOpen(false);

  return (
    <>
      {isMobile ? (
        <div className={styles.mobileNavbar}>
          <div className={styles.mobileHeader}>
            <div className={styles.mobileBrand}>
              <span className={styles.mobileBrandDot} />
              <h2 className={styles.mobileLogo}>CRM PANEL</h2>
            </div>
            <div className={styles.mobileActions}>
              <button
                className={styles.mobileIconBtn}
                onClick={() => setProfileOpen(true)}
                aria-label="Profile"
              >
                <FaUserCircle />
              </button>
              <button
                className={styles.mobileHamburger}
                onClick={toggleMobileMenu}
                aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
              >
                {isMobileMenuOpen ? <FaTimes /> : <FaBars />}
              </button>
            </div>
          </div>

          {isMobileMenuOpen && (
            <div className={styles.mobileMenuOverlay} onClick={closeMobileMenu}>
              <div className={styles.mobileMenu} onClick={(e) => e.stopPropagation()}>
                <MobileGroup
                  icon={<FaIdBadge />}
                  label="Employees"
                  isOpen={open.employees}
                  onToggle={() => setOpen((p) => ({ ...p, employees: !p.employees }))}
                >
                  {canManageEmployees && (
                    <Link to="/create" onClick={closeMobileMenu}>Create Employee</Link>
                  )}
                  <Link to="/active" onClick={closeMobileMenu}>Active Employees</Link>
                  {canManageEmployees && (
                    <Link to="/relieved" onClick={closeMobileMenu}>Relieved Employees</Link>
                  )}
                  {isAdmin && (
                    <Link to="/masters" onClick={closeMobileMenu}>Master Items</Link>
                  )}
                </MobileGroup>

                <MobileGroup
                  icon={<FaTicketAlt />}
                  label="Ticketing Tool"
                  isOpen={open.ticketing}
                  onToggle={() => setOpen((p) => ({ ...p, ticketing: !p.ticketing }))}
                >
                  <Link to="/tickets/create" onClick={closeMobileMenu}>New Ticket</Link>
                  <Link to="/tickets/open" onClick={closeMobileMenu}>Opened Tickets</Link>
                  <Link to="/tickets/closed" onClick={closeMobileMenu}>Closed Tickets</Link>
                </MobileGroup>

                {isAdmin && (
                  <MobileGroup
                    icon={<FaHandshake />}
                    label="Lead"
                    isOpen={open.onboarding}
                    onToggle={() => setOpen((p) => ({ ...p, onboarding: !p.onboarding }))}
                  >
                    <Link to="/customer-onboarding/lead-process" onClick={closeMobileMenu}>
                      New Connection Requests
                    </Link>
                    <Link to="/customer-onboarding/feasibility" onClick={closeMobileMenu}>
                      Feasibility
                    </Link>
                  </MobileGroup>
                )}

                <MobileGroup
                  icon={<FaClipboardList />}
                  label="HRD"
                  isOpen={open.hrd}
                  onToggle={() => setOpen((p) => ({ ...p, hrd: !p.hrd }))}
                >
                  {canViewOfferLetter && (
                    <Link to="/hrd/offer-letter" onClick={closeMobileMenu}>
                      Offer Letter Request
                    </Link>
                  )}
                  {canViewPayslip && (
                    <Link to="/hrd/payslip" onClick={closeMobileMenu}>
                      Payslip Request
                    </Link>
                  )}
                  {canViewRelieving && (
                    <Link to="/hrd/relieving" onClick={closeMobileMenu}>
                      Relieving Request
                    </Link>
                  )}
                  <Link to="/hrd/uniform" onClick={closeMobileMenu}>
                    Uniform Request
                  </Link>
                  {canViewManpower && (
                    <Link to="/hrd/manpower" onClick={closeMobileMenu}>
                      Manpower Request
                    </Link>
                  )}
                </MobileGroup>

                <div className={styles.mobileLogout}>
                  <Button
                    variant="contained"
                    color="error"
                    size="small"
                    fullWidth
                    startIcon={<FaSignOutAlt />}
                    onClick={() => { logout(); window.location.replace("/login"); }}
                  >
                    Logout
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div
          ref={sidebarRef}
          className={`${styles.sidebar} ${currentCollapsed ? styles.collapsed : ""}`}
        >
          <div className={styles.glowOrb} />

          <div className={styles.header}>
            {!currentCollapsed && (
              <div className={styles.brand}>
                <span className={styles.brandDot} />
                <h2 className={styles.logo}>CRM PANEL</h2>
              </div>
            )}
            <div
              className={styles.hamburger}
              onClick={() => updateCollapsed(!currentCollapsed)}
              aria-label="Toggle sidebar"
            >
              <input type="checkbox" checked={!currentCollapsed} readOnly />
              <svg viewBox="0 0 32 32">
                <path
                  className={`${styles.line} ${styles["line-top-bottom"]}`}
                  d="M27 10 13 10C10.8 10 9 8.2 9 6 9 3.5 10.8 2 13 2 
                     15.2 2 17 3.8 17 6L17 26C17 28.2 18.8 30 21 30 
                     23.2 30 25 28.2 25 26 25 23.8 23.2 22 21 22L7 22"
                />
                <path className={styles.line} d="M7 16 27 16" />
              </svg>
            </div>
          </div>

          {!currentCollapsed && userName && (
            <div className={styles.welcomeBox}>
              <p className={styles.welcomeLabel}>Welcome,</p>
              <h3 className={styles.welcomeName}>{userName}</h3>
            </div>
          )}

          <div className={styles.menuContent}>
            <DesktopGroup
              icon={<FaIdBadge className={styles.icon} />}
              label="Employees"
              isOpen={open.employees}
              collapsed={currentCollapsed}
              onToggle={() => handleToggle("employees")}
            >
              {canManageEmployees && (
                <Link to="/create" onClick={() => updateCollapsed(true)}>Create Employee</Link>
              )}
              <Link to="/active" onClick={() => updateCollapsed(true)}>Active Employees</Link>
              {canManageEmployees && (
                <Link to="/relieved" onClick={() => updateCollapsed(true)}>Relieved Employees</Link>
              )}
              {isAdmin && (
                <Link to="/masters" onClick={() => updateCollapsed(true)}>Master Items</Link>
              )}
            </DesktopGroup>

            <DesktopGroup
              icon={<FaTicketAlt className={styles.icon} />}
              label="Ticketing Tool"
              isOpen={open.ticketing}
              collapsed={currentCollapsed}
              onToggle={() => handleToggle("ticketing")}
            >
              <Link to="/tickets/create" onClick={() => updateCollapsed(true)}>New Ticket</Link>
              <Link to="/tickets/open" onClick={() => updateCollapsed(true)}>Opened Tickets</Link>
              <Link to="/tickets/closed" onClick={() => updateCollapsed(true)}>Closed Tickets</Link>
            </DesktopGroup>

            {isAdmin && (
              <DesktopGroup
                icon={<FaHandshake className={styles.icon} />}
                label="Lead"
                isOpen={open.onboarding}
                collapsed={currentCollapsed}
                onToggle={() => handleToggle("onboarding")}
              >
                <Link to="/customer-onboarding/lead-process" onClick={() => updateCollapsed(true)}>
                  New Connection Requests
                </Link>
                <Link to="/customer-onboarding/feasibility" onClick={() => updateCollapsed(true)}>
                  Feasibility
                </Link>
              </DesktopGroup>
            )}

            <DesktopGroup
              icon={<FaClipboardList className={styles.icon} />}
              label="HRD"
              isOpen={open.hrd}
              collapsed={currentCollapsed}
              onToggle={() => handleToggle("hrd")}
            >
              {canViewOfferLetter && (
                <Link to="/hrd/offer-letter" onClick={() => updateCollapsed(true)}>
                  Offer Letter Request
                </Link>
              )}
              {canViewPayslip && (
                <Link to="/hrd/payslip" onClick={() => updateCollapsed(true)}>
                  Payslip Request
                </Link>
              )}
              {canViewRelieving && (
                <Link to="/hrd/relieving" onClick={() => updateCollapsed(true)}>
                  Relieving Request
                </Link>
              )}
              <Link to="/hrd/uniform" onClick={() => updateCollapsed(true)}>
                Uniform Request
              </Link>
              {canViewManpower && (
                <Link to="/hrd/manpower" onClick={() => updateCollapsed(true)}>
                  Manpower Request
                </Link>
              )}
            </DesktopGroup>

          </div>

          <div className={styles.logout}>
            <div className={styles.footerActions}>
              {currentCollapsed ? (
                <>
                  <button
                    className={styles.iconAction}
                    onClick={() => setProfileOpen(true)}
                    aria-label="Profile"
                  >
                    <FaUserCircle />
                  </button>
                  <button
                    className={styles.iconLogout}
                    onClick={() => { logout(); window.location.replace("/login"); }}
                    aria-label="Logout"
                  >
                    <FaSignOutAlt />
                  </button>
                </>
              ) : (
                <>
                  <button
                    className={styles.profileTrigger}
                    onClick={() => setProfileOpen(true)}
                  >
                    <span className={styles.profileTriggerIcon}>
                      <FaUserCircle />
                    </span>
                    <span className={styles.profileTriggerText}>
                      <span className={styles.profileTriggerLabel}>Profile</span>
                      <span className={styles.profileTriggerValue}>{userName || "User"}</span>
                    </span>
                  </button>
                  <Button
                    variant="contained"
                    color="error"
                    size="small"
                    fullWidth
                    startIcon={<FaSignOutAlt />}
                    onClick={() => { logout(); window.location.replace("/login"); }}
                  >
                    Logout
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <ProfileModal
        open={profileOpen}
        onClose={closeProfileModal}
        userName={userName}
        userEmpId={userEmpId}
        userTeam={userTeam}
        userDesignation={userDesignation}
        userPhoto={userPhoto}
        userInitial={userInitial}
        isDark={isDark}
        canViewAdminProfileActions={isAdmin}
      />
    </>
  );
}
