import React, { useState, useEffect, useRef } from "react";
import { database, auth } from "./firebase";
import { ref, onValue, set } from "firebase/database";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, User } from "firebase/auth";
import { playBeepSound, playNewCardSound } from "./utils/sound";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell, 
  PieChart, 
  Pie, 
  Legend 
} from "recharts";
import { 
  Radio, 
  UserCheck, 
  LogOut, 
  Lock, 
  Mail, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  Calendar, 
  Clock, 
  AlertCircle,
  Database,
  Filter,
  Volume2,
  VolumeX,
  UserPlus,
  BarChart3,
  Users,
  Sparkles,
  X,
  Plus,
  Edit3,
  CreditCard,
  Bell,
  Check,
  TrendingUp,
  LayoutDashboard,
  Table as TableIcon
} from "lucide-react";

interface AttendanceRecord {
  id: string;
  uid: string;
  status: string;
  tanggal: string;
  timestamp: string;
}

interface Student {
  uid: string;
  nama: string;
  nim: string;
  kelas: string;
}

interface QuickRegisterNotification {
  uid: string;
  timestamp: string;
  tanggal: string;
}

export default function App() {
  // Authentication State
  const [user, setUser] = useState<User | null>(null);
  const [isBypassLoggedIn, setIsBypassLoggedIn] = useState<boolean>(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);

  // Realtime Data State
  const [attendanceList, setAttendanceList] = useState<AttendanceRecord[]>([]);
  const [students, setStudents] = useState<Record<string, Student>>({});
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isDatabaseConnected, setIsDatabaseConnected] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  // Settings & Sound State
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"attendance" | "analytics" | "students">("attendance");

  // Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("All");

  // Notifications & Quick Register Modal State
  const [quickNotification, setQuickNotification] = useState<QuickRegisterNotification | null>(null);
  const [latestToast, setLatestToast] = useState<{ uid: string; nama?: string; time: string } | null>(null);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  
  // Registration Form State
  const [regUid, setRegUid] = useState("");
  const [regNama, setRegNama] = useState("");
  const [regNim, setRegNim] = useState("");
  const [regKelas, setRegKelas] = useState("TE C");
  const [regSuccessMsg, setRegSuccessMsg] = useState("");

  const prevAttendanceCountRef = useRef<number | null>(null);

  // Helper to sanitize Firebase Keys
  const sanitizeKey = (uid: string) => {
    return uid.trim().replace(/[\.\#\$\[\]\/]/g, "_");
  };

  // Check Auth State on mount
  useEffect(() => {
    if (!auth) return;
    try {
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        setUser(currentUser);
      });
      return () => unsubscribe();
    } catch (e) {
      console.warn("onAuthStateChanged listener bypassed:", e);
    }
  }, []);

  const isLoggedIn = user !== null || isBypassLoggedIn;

  // Realtime Students Listener
  useEffect(() => {
    if (!isLoggedIn) return;

    const studentsRef = ref(database, "students");
    const unsubscribe = onValue(
      studentsRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.val();
          setStudents(data || {});
        } else {
          setStudents({});
        }
      },
      (error) => {
        console.warn("Error fetching students path:", error);
      }
    );

    return () => unsubscribe();
  }, [isLoggedIn]);

  // Realtime Attendance Data Listener
  useEffect(() => {
    if (!isLoggedIn) return;

    setIsLoadingData(true);
    setDbError(null);

    const attendanceRef = ref(database, "attendance");

    const unsubscribe = onValue(
      attendanceRef,
      (snapshot) => {
        setIsLoadingData(false);
        setIsDatabaseConnected(true);

        if (!snapshot.exists()) {
          setAttendanceList([]);
          return;
        }

        const data = snapshot.val();
        let parsedRecords: AttendanceRecord[] = [];

        if (Array.isArray(data)) {
          parsedRecords = data
            .filter(Boolean)
            .map((item, idx) => ({
              id: String(idx),
              uid: item.uid || item.UID || item.card_uid || "-",
              status: item.status || item.Status || "Hadir",
              tanggal: item.tanggal || item.Tanggal || item.date || "-",
              timestamp: item.timestamp || item.Timestamp || item.waktu || item.time || "-",
            }));
        } else if (typeof data === "object" && data !== null) {
          parsedRecords = Object.entries(data).map(([key, val]: [string, any]) => {
            const item = val || {};
            return {
              id: key,
              uid: item.uid || item.UID || item.card_uid || "-",
              status: item.status || item.Status || "Hadir",
              tanggal: item.tanggal || item.Tanggal || item.date || "-",
              timestamp: item.timestamp || item.Timestamp || item.waktu || item.time || "-",
            };
          });
        }

        const sortedNewestFirst = parsedRecords.reverse();

        // Detect new incoming tap for Audio and Quick Register popup
        if (prevAttendanceCountRef.current !== null && sortedNewestFirst.length > prevAttendanceCountRef.current) {
          const newestRecord = sortedNewestFirst[0];
          if (newestRecord && newestRecord.uid !== "-") {
            const sanitized = sanitizeKey(newestRecord.uid);
            const studentInfo = students[sanitized];

            if (soundEnabled) {
              if (studentInfo) {
                playBeepSound();
              } else {
                playNewCardSound();
              }
            }

            // Trigger real-time floating toast
            setLatestToast({
              uid: newestRecord.uid,
              nama: studentInfo ? studentInfo.nama : undefined,
              time: newestRecord.timestamp
            });
            setTimeout(() => setLatestToast(null), 5000);

            // If card is NOT registered yet, trigger Quick Register Notification Pop-up!
            if (!studentInfo) {
              setQuickNotification({
                uid: newestRecord.uid,
                timestamp: newestRecord.timestamp,
                tanggal: newestRecord.tanggal
              });
            }
          }
        }

        prevAttendanceCountRef.current = sortedNewestFirst.length;
        setAttendanceList(sortedNewestFirst);
      },
      (error) => {
        console.error("Firebase Realtime Database listener error:", error);
        setIsLoadingData(false);
        setIsDatabaseConnected(false);
        setDbError(error.message || "Gagal terhubung ke Firebase Realtime Database");
      }
    );

    return () => unsubscribe();
  }, [isLoggedIn, soundEnabled, students]);

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setIsLoadingAuth(true);

    if (!email || !password) {
      setLoginError("Email dan password wajib diisi");
      setIsLoadingAuth(false);
      return;
    }

        // 1. Cek dulu apakah mencoba masuk pakai akun bypass lokal admin
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      setIsBypassLoggedIn(true);
      setIsLoadingAuth(false);
      return;
    }

    // 2. Jika bukan akun admin bypass lokal, verifikasi wajib lewat Firebase Auth
    if (auth) {
      try {
        await signInWithEmailAndPassword(auth, email, password);
        setIsLoadingAuth(false);
        return;
      } catch (err: any) {
        console.error("Firebase Auth error:", err);
        let msg = "Email atau password salah.";
        if (err.code === "auth/invalid-email") msg = "Format email tidak valid.";
        if (err.code === "auth/user-not-found") msg = "Akun tidak ditemukan.";
        if (err.code === "auth/wrong-password") msg = "Password salah.";
        
        setLoginError(msg);
        setIsLoadingAuth(false);
        return; // Menghentikan login jika salah di Firebase
      }
    }

    // 3. Jika firebase auth tidak aktif & bukan admin lokal
    setLoginError("Email atau password salah.");
    setIsLoadingAuth(false);
  };

  // Handle Logout
  const handleLogout = async () => {
    if (user && auth) {
      try {
        await signOut(auth);
      } catch (err) {
        console.warn("Sign out error:", err);
      }
    }
    setUser(null);
    setIsBypassLoggedIn(false);
    setEmail("");
    setPassword("");
  };

  // Quick Register Modal Opener
  const openRegisterModalForUid = (uidToRegister: string) => {
    setRegUid(uidToRegister);
    const existing = students[sanitizeKey(uidToRegister)];
    if (existing) {
      setRegNama(existing.nama);
      setRegNim(existing.nim);
      setRegKelas(existing.kelas || "TE C");
    } else {
      setRegNama("");
      setRegNim("");
      setRegKelas("TE C");
    }
    setRegSuccessMsg("");
    setIsRegisterModalOpen(true);
    setQuickNotification(null);
  };

  // Submit Register Student
  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regUid || !regNama || !regNim) {
      alert("Harap isi UID, Nama, dan NIM.");
      return;
    }

    const key = sanitizeKey(regUid);
    const newStudentObj: Student = {
      uid: regUid.trim(),
      nama: regNama.trim(),
      nim: regNim.trim(),
      kelas: regKelas.trim()
    };

    try {
      await set(ref(database, `students/${key}`), newStudentObj);
      setRegSuccessMsg(`Berhasil mendaftarkan ${regNama} (${regNim})!`);
      setTimeout(() => {
        setIsRegisterModalOpen(false);
        setRegSuccessMsg("");
      }, 1200);
    } catch (err: any) {
      console.error("Gagal mendaftarkan mahasiswa ke Firebase:", err);
      alert("Terjadi kesalahan saat menyimpan ke database.");
    }
  };

  // Filter Attendance List
  const filteredList = attendanceList.filter((item) => {
    const student = students[sanitizeKey(item.uid)];
    const studentName = student ? student.nama.toLowerCase() : "";
    const studentNim = student ? student.nim.toLowerCase() : "";
    const studentKelas = student ? student.kelas.toLowerCase() : "";

    const searchLower = searchTerm.toLowerCase();
    const matchesSearch =
      item.uid.toLowerCase().includes(searchLower) ||
      item.tanggal.toLowerCase().includes(searchLower) ||
      item.timestamp.toLowerCase().includes(searchLower) ||
      studentName.includes(searchLower) ||
      studentNim.includes(searchLower) ||
      studentKelas.includes(searchLower);

    const matchesStatus =
      selectedStatus === "All" ||
      item.status.toLowerCase() === selectedStatus.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  // Analytics Computation
  const todayDateStr = new Date().toISOString().split("T")[0];
  const todayPresensiCount = attendanceList.filter(
    (item) => item.tanggal === todayDateStr || item.tanggal.includes(todayDateStr)
  ).length;

  const totalRegisteredCount = Object.keys(students).length;
  
  // Class attendance breakdown for chart
  const classCounts: Record<string, number> = {};
  attendanceList.forEach((record) => {
    const student = students[sanitizeKey(record.uid)];
    const k = student ? student.kelas : "Lainnya/Unregistered";
    classCounts[k] = (classCounts[k] || 0) + 1;
  });

  const classChartData = Object.entries(classCounts).map(([kelas, count]) => ({
    kelas,
    count,
    percentage: Math.round((count / (attendanceList.length || 1)) * 100)
  }));

  const registeredTappedCount = attendanceList.filter(r => !!students[sanitizeKey(r.uid)]).length;
  const unregisteredTappedCount = attendanceList.length - registeredTappedCount;

  const pieData = [
    { name: "Terdaftar", value: registeredTappedCount, color: "#6366f1" },
    { name: "Belum Terdaftar", value: unregisteredTappedCount, color: "#f43f5e" }
  ];

  // Render Login Page
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-800/90 border border-slate-700/80 rounded-2xl p-8 shadow-2xl backdrop-blur-sm">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-10 h-10 rounded-xl overflow-hidden">
  <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
</div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Sistem Presensi RFID
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Monitoring Data Presensi Realtime ESP32
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            {loginError && (
              <div className="flex items-center gap-3 p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-sm">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@gmail.com"
                  className="w-full pl-11 pr-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-11 pr-4 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoadingAuth}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white font-medium rounded-xl transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 text-sm cursor-pointer"
            >
              {isLoadingAuth ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Memproses...</span>
                </>
              ) : (
                <span>Masuk Ke Dashboard</span>
              )}
            </button>
          </form>

          
        </div>
      </div>
    );
  }

  // Render Dashboard
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col relative">
      {/* Realtime Tap Toast Notification */}
      {latestToast && (
        <div className="fixed top-20 right-4 z-50 bg-slate-800 border border-indigo-500/50 text-white p-4 rounded-xl shadow-2xl flex items-center gap-3 animate-bounce max-w-sm">
          <div className="w-10 h-10 rounded-lg bg-indigo-600/30 text-indigo-400 flex items-center justify-center shrink-0">
            <Bell className="w-5 h-5 animate-spin" />
          </div>
          <div>
            <p className="text-xs font-semibold text-indigo-300">Tap RFID Dideteksi!</p>
            <p className="text-sm font-bold text-white mt-0.5">
              {latestToast.nama ? latestToast.nama : `UID: ${latestToast.uid}`}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Waktu: {latestToast.time}</p>
          </div>
        </div>
      )}

      {/* Quick Register Banner Notification */}
      {quickNotification && (
        <div className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-rose-900/90 to-amber-900/90 border border-amber-500/60 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-4 max-w-md backdrop-blur-md">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-400/40 flex items-center justify-center shrink-0">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div className="flex-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-300">
              ⚡ Kartu Baru Dideteksi!
            </span>
            <p className="text-sm font-bold font-mono text-white mt-0.5">
              UID: {quickNotification.uid}
            </p>
            <button
              onClick={() => openRegisterModalForUid(quickNotification.uid)}
              className="mt-2 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-900 px-3 py-1.5 rounded-lg transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Klik untuk Isi Nama & NIM</span>
            </button>
          </div>
          <button
            onClick={() => setQuickNotification(null)}
            className="text-slate-400 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Navbar */}
      <header className="bg-slate-800/80 border-b border-slate-700/80 sticky top-0 z-20 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl overflow-hidden">
  <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
</div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight leading-none">
                Presensi RFID ESP32
              </h1>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span className="text-emerald-400 font-medium">Realtime Active</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Audio Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? "Mute Beep Sound" : "Enable Beep Sound"}
              className={`p-2 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                soundEnabled
                  ? "bg-indigo-600/20 border-indigo-500/40 text-indigo-300 hover:bg-indigo-600/30"
                  : "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"
              }`}
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-4 h-4 text-indigo-400" />
                  <span className="hidden sm:inline">Suara On</span>
                </>
              ) : (
                <>
                  <VolumeX className="w-4 h-4 text-slate-400" />
                  <span className="hidden sm:inline">Mute</span>
                </>
              )}
            </button>

            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-900/60 border border-slate-700 rounded-lg text-xs text-slate-300">
              <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>{user?.email || "Admin Mode"}</span>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-700/60 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg border border-slate-600/80 text-xs font-medium transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-700/50 flex gap-2 pt-2 overflow-x-auto whitespace-nowrap scrollbar-none">
          <div className="flex items-center gap-2 bg-slate-800/80 p-1.5 rounded-xl border border-slate-700/80">
            <button
              onClick={() => setActiveTab("attendance")}
               className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-all cursor-pointer shrink-0 ${
                activeTab === "attendance"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <TableIcon className="w-4 h-4" />
              <span>Daftar Presensi</span>
            </button>

            <button
              onClick={() => setActiveTab("analytics")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "analytics"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Statistik & Grafik</span>
            </button>

            <button
              onClick={() => setActiveTab("students")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                activeTab === "students"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Data Mahasiswa ({totalRegisteredCount})</span>
            </button>
          </div>

          <button
            onClick={() => openRegisterModalForUid("")}
            className="flex items-center gap-2 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Register Kartu Baru</span>
          </button>
        </div>

        {/* Status Bar & Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Total Presensi Tap
              </p>
              <p className="text-2xl font-bold text-white mt-1">
                {attendanceList.length}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <UserCheck className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Mahasiswa Terdaftar
              </p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">
                {totalRegisteredCount}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Kartu Belum Terdaftar
              </p>
              <p className="text-2xl font-bold text-rose-400 mt-1">
                {unregisteredTappedCount}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
              <CreditCard className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Koneksi Realtime
              </p>
              <p className="text-sm font-semibold text-sky-400 mt-1 flex items-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
                <span>ESP32 Ready</span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl overflow-hidden">
  <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
</div>
          </div>
        </div>

        {/* Database Error Warning */}
        {dbError && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
            <div>
              <p className="font-semibold">Peringatan Koneksi Database</p>
              <p className="text-xs text-amber-300/80 mt-0.5">{dbError}</p>
            </div>
          </div>
        )}

        {/* TAB 1: ATTENDANCE TABLE */}
        {activeTab === "attendance" && (
          <div className="space-y-6">
            {/* Table Filter Controls */}
            <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Cari Nama, NIM, UID, atau Tanggal..."
                  className="w-full pl-10 pr-4 py-2 bg-slate-900/80 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all text-sm"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Filter className="w-4 h-4 text-slate-400" />
                <span className="text-xs text-slate-400 font-medium">Status:</span>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                >
                  <option value="All">Semua Status</option>
                  <option value="Hadir">Hadir</option>
                </select>
              </div>
            </div>

            {/* Attendance Table Section */}
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl shadow-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-700/80 flex items-center justify-between">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <span>Daftar Presensi RFID</span>
                  <span className="text-xs bg-slate-700 text-slate-300 font-normal px-2.5 py-0.5 rounded-full">
                    {filteredList.length} Entri
                  </span>
                </h2>
                <span className="text-xs text-slate-400 font-mono">Firebase /attendance/</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-900/60 text-slate-400 uppercase text-[11px] font-semibold tracking-wider border-b border-slate-700/80">
                    <tr>
                      <th className="px-6 py-3.5">No</th>
                      <th className="px-6 py-3.5">Nama & NIM</th>
                      <th className="px-6 py-3.5">UID RFID</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5">Tanggal</th>
                      <th className="px-6 py-3.5">Waktu</th>
                      <th className="px-6 py-3.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50 text-slate-200">
                    {isLoadingData ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                          <div className="flex flex-col items-center justify-center gap-3">
                            <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
                            <span>Memuat data presensi dari Firebase...</span>
                          </div>
                        </td>
                      </tr>
                    ) : filteredList.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-16 text-center">
                          <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                            <div className="w-10 h-10 rounded-xl overflow-hidden">
  <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
</div>
                            <p className="text-base font-medium text-slate-300">
                              Belum ada data presensi
                            </p>
                            <p className="text-xs text-slate-500 max-w-sm">
                              Data presensi yang dipindai dari ESP32 di path /attendance/ akan muncul di sini secara otomatis.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredList.map((item, index) => {
                        const student = students[sanitizeKey(item.uid)];
                        return (
                          <tr
                            key={item.id}
                            className="hover:bg-slate-700/30 transition-colors"
                          >
                            <td className="px-6 py-4 text-xs text-slate-400 font-mono">
                              {index + 1}
                            </td>

                            <td className="px-6 py-4">
                              {student ? (
                                <div>
                                  <p className="font-semibold text-white text-sm">{student.nama}</p>
                                  <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                                    <span>NIM: {student.nim}</span>
                                    <span className="px-1.5 py-0.2 bg-slate-700 text-indigo-300 rounded text-[10px] font-mono">
                                      {student.kelas}
                                    </span>
                                  </p>
                                </div>
                              ) : (
                                <div>
                                  <span className="text-xs text-amber-400 italic flex items-center gap-1 font-medium">
                                    <AlertCircle className="w-3.5 h-3.5" />
                                    Belum Terdaftar
                                  </span>
                                  <p className="text-[11px] text-slate-500">Tap untuk mendaftarkan</p>
                                </div>
                              )}
                            </td>

                            <td className="px-6 py-4 font-mono text-sm font-semibold text-indigo-300">
                              {item.uid}
                            </td>

                            <td className="px-6 py-4">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                {item.status}
                              </span>
                            </td>

                            <td className="px-6 py-4 text-slate-300">
                              <div className="flex items-center gap-1.5 text-xs">
                                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                <span>{item.tanggal}</span>
                              </div>
                            </td>

                            <td className="px-6 py-4 text-slate-300">
                              <div className="flex items-center gap-1.5 text-xs font-mono">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                <span>{item.timestamp}</span>
                              </div>
                            </td>

                            <td className="px-6 py-4 text-right">
                              {student ? (
                                <button
                                  onClick={() => openRegisterModalForUid(item.uid)}
                                  className="text-xs text-slate-400 hover:text-indigo-300 p-1.5 rounded-lg hover:bg-slate-700 transition-all cursor-pointer"
                                  title="Edit Mahasiswa"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => openRegisterModalForUid(item.uid)}
                                  className="px-2.5 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500 hover:text-slate-900 font-medium text-xs rounded-lg transition-all flex items-center gap-1 ml-auto cursor-pointer"
                                >
                                  <UserPlus className="w-3 h-3" />
                                  <span>Daftarkan</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ANALYTICS & CHARTS */}
        {activeTab === "analytics" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Bar Chart: Attendance per Class */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-indigo-400" />
                      <span>Kehadiran Per Kelas</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Jumlah & persentase presensi mahasiswa per kelas
                    </p>
                  </div>
                </div>

                <div className="h-72 w-full pt-4">
                  {classChartData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                      Belum ada data presensi untuk dibuat grafik
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={classChartData}>
                        <XAxis dataKey="kelas" stroke="#94a3b8" fontSize={12} />
                        <YAxis stroke="#94a3b8" fontSize={12} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1e293b",
                            borderColor: "#334155",
                            borderRadius: "0.5rem",
                            color: "#fff"
                          }}
                        />
                        <Bar dataKey="count" name="Jumlah Hadir" fill="#6366f1" radius={[6, 6, 0, 0]}>
                          {classChartData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={index % 2 === 0 ? "#6366f1" : "#818cf8"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Pie Chart: Registration Distribution */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <TrendingUp className="w-5 h-5 text-emerald-400" />
                      <span>Rasio Status Kartu RFID</span>
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Kartu terdaftar vs belum terdaftar yang terdeteksi
                    </p>
                  </div>
                </div>

                <div className="h-72 w-full pt-4">
                  {attendanceList.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                      Belum ada data presensi
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1e293b",
                            borderColor: "#334155",
                            borderRadius: "0.5rem",
                            color: "#fff"
                          }}
                        />
                        <Legend wrapperStyle={{ color: "#cbd5e1", fontSize: "12px" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: REGISTERED STUDENTS LIST */}
        {activeTab === "students" && (
          <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl shadow-xl overflow-hidden space-y-4 p-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-700/80 pb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-400" />
                  <span>Daftar Mahasiswa Terdaftar</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Path RTDB: /students/
                </p>
              </div>

              <button
                onClick={() => openRegisterModalForUid("")}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Mahasiswa</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900/60 text-slate-400 uppercase text-[11px] font-semibold tracking-wider border-b border-slate-700/80">
                  <tr>
                    <th className="px-6 py-3">No</th>
                    <th className="px-6 py-3">Nama Mahasiswa</th>
                    <th className="px-6 py-3">NIM</th>
                    <th className="px-6 py-3">Kelas</th>
                    <th className="px-6 py-3">UID RFID</th>
                    <th className="px-6 py-3 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50 text-slate-200">
                  {Object.keys(students).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                        Belum ada mahasiswa yang terdaftar. Klik "+ Register Kartu Baru" untuk menambahkan.
                      </td>
                    </tr>
                  ) : (
                    (Object.values(students) as Student[]).map((st, i) => (
                      <tr key={st.uid} className="hover:bg-slate-700/30">
                        <td className="px-6 py-3.5 text-xs text-slate-400 font-mono">{i + 1}</td>
                        <td className="px-6 py-3.5 font-semibold text-white">{st.nama}</td>
                        <td className="px-6 py-3.5 text-slate-300 font-mono text-xs">{st.nim}</td>
                        <td className="px-6 py-3.5">
                          <span className="px-2 py-0.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 rounded text-xs">
                            {st.kelas}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 font-mono text-xs text-indigo-300">{st.uid}</td>
                        <td className="px-6 py-3.5 text-right">
                          <button
                            onClick={() => openRegisterModalForUid(st.uid)}
                            className="text-slate-400 hover:text-indigo-300 p-1.5 rounded-lg hover:bg-slate-700 transition-all cursor-pointer"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Quick Register Modal */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl relative space-y-5 animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setIsRegisterModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-700"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-700 pb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                <UserPlus className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Quick Register Kartu RFID</h3>
                <p className="text-xs text-slate-400">Hubungkan UID RFID dengan Data Mahasiswa</p>
              </div>
            </div>

            {regSuccessMsg && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400" />
                <span>{regSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveStudent} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  UID Kartu RFID
                </label>
                <div className="relative">
                  <CreditCard className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={regUid}
                    onChange={(e) => setRegUid(e.target.value)}
                    placeholder="Contoh: C3 A1 2B 1D"
                    className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Nama Lengkap Mahasiswa
                </label>
                <input
                  type="text"
                  value={regNama}
                  onChange={(e) => setRegNama(e.target.value)}
                  placeholder="Contoh: EKHY ganteng"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  NIM
                </label>
                <input
                  type="text"
                  value={regNim}
                  onChange={(e) => setRegNim(e.target.value)}
                  placeholder="Contoh: 220536602097"
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Kelas
                </label>
                <select
                  value={regKelas}
                  onChange={(e) => setRegKelas(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                >
                  <option value="TI-C">TE C</option>
                  <option value="TE B">TE B</option>
                  <option value="TE A">TE A</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-xs font-medium transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-xl text-xs transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  Simpan Mahasiswa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
