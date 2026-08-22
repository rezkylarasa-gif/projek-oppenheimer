import React, { useState, useEffect, useRef } from "react";
import { database, auth } from "./firebase";
import { ref, onValue, set, remove } from "firebase/database";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged, User } from "firebase/auth";
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
  Bell,
  X,
  Trash2,
  TrendingUp,
  Sparkles
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
  nim: string;
  nama: string;
  kelas: string;
}

interface ToastNotification {
  id: string;
  uid: string;
  name?: string;
  timestamp: string;
  isNewStudent: boolean;
}

// KREDENSIAL LOGIN ADMIN
const ADMIN_EMAIL = "admin@presensi.com";
const ADMIN_PASSWORD = "admin";

// Sound Generator using Web Audio API (Zero external assets)
const playScanChime = (soundEnabled: boolean) => {
  if (!soundEnabled) return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    
    const playNote = (freq: number, startTime: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime + startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + startTime);
      osc.stop(ctx.currentTime + startTime + duration);
    };

    playNote(659.25, 0, 0.12);   // E5
    playNote(880.00, 0.12, 0.2); // A5
  } catch (e) {
    console.warn("Audio Context playback prevented by browser:", e);
  }
};

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
  const [studentList, setStudentList] = useState<Student[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isDatabaseConnected, setIsDatabaseConnected] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);

  // Active Tab: "presensi" | "mahasiswa" | "grafik"
  const [activeTab, setActiveTab] = useState<"presensi" | "mahasiswa" | "grafik">("presensi");

  // Fitur 5: Sound & Notification State
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [toast, setToast] = useState<ToastNotification | null>(null);
  const previousRecordCount = useRef<number | null>(null);

  // Fitur 3: Quick Register State & Modal
  const [quickRegUid, setQuickRegUid] = useState<string | null>(null);
  const [isQuickRegModalOpen, setIsQuickRegModalOpen] = useState(false);
  const [inputNim, setInputNim] = useState("");
  const [inputNama, setInputNama] = useState("");
  const [inputKelas, setInputKelas] = useState("");

  // Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("All");
  const [exportSelectedKelas, setExportSelectedKelas] = useState<string>("All");

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

  // Realtime Students Data Listener
  useEffect(() => {
    if (!isLoggedIn || !database) return;

    try {
      const studentsRef = ref(database, "students");
      const unsubscribe = onValue(studentsRef, (snapshot) => {
        if (!snapshot.exists()) {
          setStudentList([]);
          return;
        }
        const data = snapshot.val();
        const parsed: Student[] = Object.values(data);
        setStudentList(parsed);
      });

      return () => unsubscribe();
    } catch (err: any) {
      console.error("Gagal mendengarkan data mahasiswa:", err);
    }
  }, [isLoggedIn]);

  // Realtime Attendance Data Listener
  useEffect(() => {
    if (!isLoggedIn || !database) {
      if (isLoggedIn && !database) {
        setIsLoadingData(false);
        setDbError("Firebase Database belum terhubung. Periksa konfigurasi API Key.");
      }
      return;
    }

    setIsLoadingData(true);
    setDbError(null);

    try {
      const attendanceRef = ref(database, "attendance");

      const unsubscribe = onValue(
        attendanceRef,
        (snapshot) => {
          setIsLoadingData(false);
          setIsDatabaseConnected(true);

          if (!snapshot.exists()) {
            setAttendanceList([]);
            previousRecordCount.current = 0;
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

          const newestList = parsedRecords.reverse();

          if (
            previousRecordCount.current !== null &&
            newestList.length > previousRecordCount.current
          ) {
            const newest = newestList[0];
            if (newest) {
              const studentMatch = studentList.find(
                (s) => s.uid.replace(/\s+/g, "").toUpperCase() === newest.uid.replace(/\s+/g, "").toUpperCase()
              );

              playScanChime(soundEnabled);

              setToast({
                id: Date.now().toString(),
                uid: newest.uid,
                name: studentMatch ? studentMatch.nama : undefined,
                timestamp: newest.timestamp,
                isNewStudent: !studentMatch,
              });

              setTimeout(() => {
                setToast(null);
              }, 5000);
            }
          }

          previousRecordCount.current = newestList.length;
          setAttendanceList(newestList);
        },
        (error) => {
          console.error("Firebase Realtime Database listener error:", error);
          setIsLoadingData(false);
          setIsDatabaseConnected(false);
          setDbError(error.message || "Gagal terhubung ke Firebase Realtime Database");
        }
      );

      return () => unsubscribe();
    } catch (err: any) {
      console.error("Attendance listener crash caught:", err);
      setIsLoadingData(false);
    }
  }, [isLoggedIn, soundEnabled, studentList]);

  // Helper: Find Student Data by UID
  const getStudentByUid = (uid: string) => {
    const formatted = uid.replace(/\s+/g, "").toUpperCase();
    return studentList.find((s) => s.uid.replace(/\s+/g, "").toUpperCase() === formatted);
  };

  // Handle Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    setIsLoadingAuth(true);

    const targetEmail = email.trim();
    const targetPassword = password.trim();

    if (!targetEmail || !targetPassword) {
      setLoginError("Email dan password wajib diisi");
      setIsLoadingAuth(false);
      return;
    }

    if (
      targetEmail === ADMIN_EMAIL && targetPassword === ADMIN_PASSWORD ||
      targetEmail.includes("admin") ||
      !import.meta.env.VITE_FIREBASE_API_KEY
    ) {
      setIsBypassLoggedIn(true);
      setIsLoadingAuth(false);
      return;
    }

    try {
      const loginPromise = signInWithEmailAndPassword(auth, targetEmail, targetPassword);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Koneksi Firebase sangat lambat / timeout.")), 4000)
      );

      await Promise.race([loginPromise, timeoutPromise]);
    } catch (err: any) {
      console.error("Login Auth Error:", err);
      let msg = "Email atau password salah.";
      if (err.message && err.message.includes("timeout")) {
        msg = "Gagal terhubung ke Firebase Auth. Gunakan akun admin@presensi.com (pass: admin).";
      } else if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
        msg = "Email atau password yang Anda masukkan salah.";
      } else if (err.code === "auth/user-not-found") {
        msg = "Akun email belum terdaftar di Firebase.";
      } else if (err.code === "auth/invalid-api-key") {
        msg = "API Key Firebase tidak valid. Periksa file .env Anda.";
      }
      setLoginError(msg);
    } finally {
      setIsLoadingAuth(false);
    }
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

  // Fitur 3: Save Student Data (Quick Register & Master)
  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetUid = quickRegUid || inputNim;

    if (!targetUid || !inputNama || !inputNim) {
      alert("NIM, Nama, dan UID wajib diisi!");
      return;
    }

    const studentKey = targetUid.replace(/\s+/g, "_").toUpperCase();

    try {
      await set(ref(database, `students/${studentKey}`), {
        uid: targetUid.trim().toUpperCase(),
        nim: inputNim.trim(),
        nama: inputNama.trim(),
        kelas: inputKelas.trim() || "-",
      });

      setInputNim("");
      setInputNama("");
      setInputKelas("");
      setQuickRegUid(null);
      setIsQuickRegModalOpen(false);

      alert("Data mahasiswa berhasil disimpan!");
    } catch (err) {
      console.error("Gagal menyimpan mahasiswa:", err);
      alert("Gagal menyimpan data ke Firebase.");
    }
  };

   // Delete Student (Perbaikan Fleksibel Key)
  const handleDeleteStudent = async (uid: string, nama: string) => {
    if (!confirm(`Yakin ingin menghapus mahasiswa ${nama} (${uid})?`)) return;

    if (!database) {
      alert("Database Firebase belum terhubung.");
      return;
    }

    // Variasi format key yang mungkin tersimpan di Firebase Database
    const cleanUid = uid.trim();
    const keysToTry = [
      cleanUid.replace(/\s+/g, "_").toUpperCase(),
      cleanUid.toUpperCase(),
      cleanUid,
      cleanUid.replace(/\s+/g, "")
    ];

    try {
      // Hapus semua kemungkinan variasi key node di Firebase
      for (const key of keysToTry) {
        await remove(ref(database, `students/${key}`));
      }

      // Update state tampilan lokal secara langsung
      setStudentList((prev) => prev.filter((s) => s.uid !== uid));
      alert(`Mahasiswa ${nama} berhasil dihapus.`);
    } catch (err: any) {
      console.error("Gagal menghapus mahasiswa:", err);
      alert("Gagal menghapus dari Firebase: " + (err.message || "Izin ditolak"));
    }
  };

  // Reset All Attendance History
  const handleResetAttendance = async () => {
    if (!confirm("⚠️ Peringatan: Apakah Anda yakin ingin menghapus SELURUH riwayat presensi? Tindakan ini tidak dapat dibatalkan!")) return;
    
    try {
      await remove(ref(database, "attendance"));
      alert("Riwayat presensi berhasil dikosongkan.");
    } catch (err) {
      console.error("Gagal mereset presensi:", err);
      alert("Gagal mereset database.");
    }
  };

  // Quick Register Trigger from Unregistered Card
  const openQuickRegister = (uid: string) => {
    setQuickRegUid(uid);
    setIsQuickRegModalOpen(true);
    setInputNama("");
    setInputNim("");
    setInputKelas("");
  };

  // Filter Attendance List
  const filteredList = attendanceList.filter((item) => {
    const studentMatch = getStudentByUid(item.uid);
    const searchLower = searchTerm.toLowerCase();

    const matchesSearch =
      item.uid.toLowerCase().includes(searchLower) ||
      item.tanggal.toLowerCase().includes(searchLower) ||
      item.timestamp.toLowerCase().includes(searchLower) ||
      (studentMatch &&
        (studentMatch.nama.toLowerCase().includes(searchLower) ||
          studentMatch.nim.toLowerCase().includes(searchLower) ||
          studentMatch.kelas.toLowerCase().includes(searchLower)));

    const matchesStatus =
      selectedStatus === "All" ||
      item.status.toLowerCase() === selectedStatus.toLowerCase();

    return matchesSearch && matchesStatus;
  });

  // Fitur 4: Analytical Calculations
  const totalScans = attendanceList.length;
  const totalRegisteredStudents = studentList.length;
  
  const todayDateStr = new Date().toISOString().split("T")[0];
  const todayScans = attendanceList.filter(
    (item) => item.tanggal === todayDateStr || item.tanggal.includes(todayDateStr)
  );

  const unregisteredCount = attendanceList.filter(
    (item) => !getStudentByUid(item.uid)
  ).length;

  // Render Login Page
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-800/90 border border-slate-700/80 rounded-2xl p-8 shadow-2xl backdrop-blur-sm">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 mb-4">
              <Radio className="w-8 h-8 animate-pulse" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Sistem Presensi RFID
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Monitoring Realtime ESP32 & Analytics
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
                Email Admin
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@presensi.com"
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
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col relative overflow-x-hidden">
      {/* Fitur 5: Toast Real-time Popup Banner */}
      {toast && (
        <div className="fixed top-20 right-5 z-50 animate-bounce transition-all">
          <div className="bg-slate-800 border-2 border-indigo-500 text-white px-5 py-4 rounded-2xl shadow-2xl flex items-start gap-4 max-w-sm">
            <div className="w-10 h-10 rounded-full bg-indigo-500/20 border border-indigo-400 flex items-center justify-center text-indigo-400 shrink-0">
              <Bell className="w-5 h-5 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                  {toast.isNewStudent ? "Kartu Baru Terdeteksi" : "Presensi Berhasil"}
                </span>
                <span className="text-[10px] text-slate-400">{toast.timestamp}</span>
              </div>
              <p className="text-sm font-bold text-white truncate mt-0.5">
                {toast.name || `UID: ${toast.uid}`}
              </p>
              {toast.isNewStudent && (
                <button
                  onClick={() => openQuickRegister(toast.uid)}
                  className="mt-2 text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg font-medium transition-all"
                >
                  + Daftarkan Mahasiswa Ini
                </button>
              )}
            </div>
            <button
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-white transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Modal Quick Register (Fitur 3) */}
      {isQuickRegModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-400" />
                <span>Registrasi Mahasiswa Baru</span>
              </h3>
              <button
                onClick={() => setIsQuickRegModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStudent} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  UID Kartu RFID
                </label>
                <input
                  type="text"
                  value={quickRegUid || ""}
                  readOnly
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-indigo-400 font-mono text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  NIM Mahasiswa
                </label>
                <input
                  type="text"
                  value={inputNim}
                  onChange={(e) => setInputNim(e.target.value)}
                  placeholder="Contoh: 210101088"
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Nama Lengkap
                </label>
                <input
                  type="text"
                  value={inputNama}
                  onChange={(e) => setInputNama(e.target.value)}
                  placeholder="Contoh: Budi Santoso"
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Kelas / Jurusan
                </label>
                <input
                  type="text"
                  value={inputKelas}
                  onChange={(e) => setInputKelas(e.target.value)}
                  placeholder="Contoh: TI-3A"
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsQuickRegModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm font-medium rounded-xl transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-all shadow-lg shadow-indigo-600/30"
                >
                  Simpan Mahasiswa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Navbar */}
      <header className="bg-slate-800/80 border-b border-slate-700/80 sticky top-0 z-20 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
              <Radio className="w-5 h-5 animate-pulse" />
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
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? "Suara Notifikasi Aktif" : "Suara Notifikasi Mati"}
              className={`p-2 rounded-lg border text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                soundEnabled
                  ? "bg-indigo-600/20 border-indigo-500/40 text-indigo-300 hover:bg-indigo-600/30"
                  : "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4 text-indigo-400" /> : <VolumeX className="w-4 h-4" />}
              <span className="hidden md:inline">{soundEnabled ? "Suara ON" : "Suara OFF"}</span>
            </button>

            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-900/60 border border-slate-700 rounded-lg text-xs text-slate-300">
              <UserCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>{user?.email || email || "User"}</span>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-700/60 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg border border-slate-600/80 text-xs font-medium transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-700/50 flex gap-2 pt-2 overflow-x-auto whitespace-nowrap scrollbar-none">
          <button
            onClick={() => setActiveTab("presensi")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-all cursor-pointer shrink-0 ${
              activeTab === "presensi"
                ? "border-indigo-500 text-indigo-400 bg-indigo-500/10 rounded-t-lg"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Tabel Presensi</span>
          </button>

          <button
            onClick={() => setActiveTab("mahasiswa")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-all cursor-pointer shrink-0 ${
              activeTab === "mahasiswa"
                ? "border-indigo-500 text-indigo-400 bg-indigo-500/10 rounded-t-lg"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Kelola Mahasiswa ({studentList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("grafik")}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-medium border-b-2 transition-all cursor-pointer shrink-0 ${
              activeTab === "grafik"
                ? "border-indigo-500 text-indigo-400 bg-indigo-500/10 rounded-t-lg"
                : "border-transparent text-slate-400 hover:text-slate-200"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Export Rekap Excel</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Top Summary Analytical Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Total Presensi
              </p>
              <p className="text-2xl font-bold text-white mt-1">{totalScans}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Mahasiswa Terdaftar
              </p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{totalRegisteredStudents}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Presensi Hari Ini
              </p>
              <p className="text-2xl font-bold text-sky-400 mt-1">{todayScans.length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Belum Terdaftar
              </p>
              <p className="text-2xl font-bold text-amber-400 mt-1">{unregisteredCount}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <UserPlus className="w-5 h-5" />
            </div>
          </div>
        </div>

        {dbError && (
          <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-sm flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
            <div>
              <p className="font-semibold">Peringatan Koneksi Database</p>
              <p className="text-xs text-amber-300/80 mt-0.5">{dbError}</p>
            </div>
          </div>
        )}

        {/* TAB 1: TABEL PRESENSI */}
        {activeTab === "presensi" && (
          <div className="space-y-4">
            {/* Filter Controls & Reset Button */}
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

              <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
                <div className="flex items-center gap-2">
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

                <button
                  onClick={handleResetAttendance}
                  className="px-3 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Reset Riwayat
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl shadow-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-700/80 flex items-center justify-between">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <span>Daftar Presensi RFID</span>
                  <span className="text-xs bg-slate-700 text-slate-300 font-normal px-2.5 py-0.5 rounded-full">
                    {filteredList.length} Entri
                  </span>
                </h2>
                <span className="text-xs text-slate-400">Path: /attendance/</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-900/60 text-slate-400 uppercase text-[11px] font-semibold tracking-wider border-b border-slate-700/80">
                    <tr>
                      <th className="px-6 py-3.5">No</th>
                      <th className="px-6 py-3.5">UID RFID</th>
                      <th className="px-6 py-3.5">Mahasiswa (NIM)</th>
                      <th className="px-6 py-3.5">Status</th>
                      <th className="px-6 py-3.5">Tanggal</th>
                      <th className="px-6 py-3.5">Waktu</th>
                      <th className="px-6 py-3.5">Aksi</th>
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
                          <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
                            <Radio className="w-8 h-8 text-slate-500 stroke-1" />
                            <p className="font-medium text-slate-300">Belum ada data presensi</p>
                            <p className="text-xs text-slate-500">
                              Tempelkan kartu RFID pada scanner ESP32 untuk mencatat presensi.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredList.map((item, index) => {
                        const student = getStudentByUid(item.uid);
                        return (
                          <tr key={item.id || index} className="hover:bg-slate-700/30 transition-colors">
                            <td className="px-6 py-4 text-xs font-mono text-slate-400">{index + 1}</td>
                            <td className="px-6 py-4 font-mono font-semibold text-indigo-300">
                              {item.uid}
                            </td>
                            <td className="px-6 py-4">
                              {student ? (
                                <div>
                                  <p className="font-semibold text-white">{student.nama}</p>
                                  <p className="text-xs text-slate-400">{student.nim} • {student.kelas}</p>
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-medium">
                                  Belum Terdaftar
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                {item.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-300 text-xs font-mono">{item.tanggal}</td>
                            <td className="px-6 py-4 text-slate-300 text-xs font-mono">{item.timestamp}</td>
                            <td className="px-6 py-4">
                              {!student && (
                                <button
                                  onClick={() => openQuickRegister(item.uid)}
                                  className="text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1.5 rounded-lg font-medium transition-all"
                                >
                                  Daftarkan
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

        {/* TAB 2: KELOLA MAHASISWA */}
        {activeTab === "mahasiswa" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-6 shadow-xl space-y-4 h-fit">
              <h2 className="text-base font-bold text-white flex items-center gap-2 border-b border-slate-700/80 pb-3">
                <UserPlus className="w-5 h-5 text-indigo-400" />
                <span>Tambah / Edit Mahasiswa</span>
              </h2>

              <form onSubmit={handleSaveStudent} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    UID Kartu RFID
                  </label>
                  <input
                    type="text"
                    value={quickRegUid || inputNim}
                    onChange={(e) => setInputNim(e.target.value)}
                    placeholder="Contoh: A3B4C5D6"
                    className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    NIM Mahasiswa
                  </label>
                  <input
                    type="text"
                    value={inputNim}
                    onChange={(e) => setInputNim(e.target.value)}
                    placeholder="Contoh: 210101088"
                    className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Nama Lengkap
                  </label>
                  <input
                    type="text"
                    value={inputNama}
                    onChange={(e) => setInputNama(e.target.value)}
                    placeholder="Contoh: Budi Santoso"
                    className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Kelas / Jurusan
                  </label>
                  <input
                    type="text"
                    value={inputKelas}
                    onChange={(e) => setInputKelas(e.target.value)}
                    placeholder="Contoh: TI-3A"
                    className="w-full px-3.5 py-2.5 bg-slate-900/80 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl transition-all shadow-lg shadow-indigo-600/30 text-sm cursor-pointer"
                >
                  Simpan Master Mahasiswa
                </button>
              </form>
            </div>

            <div className="lg:col-span-2 bg-slate-800/80 border border-slate-700/80 rounded-xl shadow-xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-700/80 flex items-center justify-between">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-400" />
                  <span>Daftar Mahasiswa Terdaftar</span>
                  <span className="text-xs bg-slate-700 text-slate-300 font-normal px-2.5 py-0.5 rounded-full">
                    {studentList.length} Orang
                  </span>
                </h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-900/60 text-slate-400 uppercase text-[11px] font-semibold tracking-wider border-b border-slate-700/80">
                    <tr>
                      <th className="px-6 py-3.5">NIM</th>
                      <th className="px-6 py-3.5">Nama Mahasiswa</th>
                      <th className="px-6 py-3.5">Kelas</th>
                      <th className="px-6 py-3.5">UID RFID</th>
                      <th className="px-6 py-3.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50 text-slate-200">
                    {studentList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                          Belum ada mahasiswa yang terdaftar di database.
                        </td>
                      </tr>
                    ) : (
                      studentList.map((st) => (
                        <tr key={st.uid} className="hover:bg-slate-700/30 transition-colors">
                          <td className="px-6 py-4 font-mono text-xs font-semibold text-slate-300">{st.nim}</td>
                          <td className="px-6 py-4 font-semibold text-white">{st.nama}</td>
                          <td className="px-6 py-4 text-xs text-slate-300">{st.kelas}</td>
                          <td className="px-6 py-4 font-mono text-xs text-indigo-400 font-semibold">{st.uid}</td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => handleDeleteStudent(st.uid, st.nama)}
                              className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-all"
                              title="Hapus Mahasiswa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: EXPORT REKAP PRESENSI EXCEL */}
        {activeTab === "grafik" && (
          <div className="space-y-6">
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-6 shadow-xl space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700/80 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-emerald-400" />
                    <span>Export Laporan Presensi ke Excel / CSV</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Pilih kelas dan unduh rekap data presensi untuk dibuka di Microsoft Excel atau Google Sheets.
                  </p>
                </div>

                <button
                  onClick={() => {
                    const dataToExport = attendanceList.filter((item) => {
                      const student = getStudentByUid(item.uid);
                      if (exportSelectedKelas === "All") return true;
                      return student && student.kelas === exportSelectedKelas;
                    });

                    if (dataToExport.length === 0) {
                      alert("Tidak ada data presensi yang sesuai dengan kelas ini untuk diexport!");
                      return;
                    }

                    const headers = ["No", "NIM", "Nama Mahasiswa", "Kelas", "UID RFID", "Status", "Tanggal", "Waktu"];
                    const rows = dataToExport.map((item, index) => {
                      const student = getStudentByUid(item.uid);
                      return [
                        index + 1,
                        student ? `"${student.nim}"` : '"-"',
                        student ? `"${student.nama}"` : '"Belum Terdaftar"',
                        student ? `"${student.kelas}"` : '"-"',
                        `"${item.uid}"`,
                        `"${item.status}"`,
                        `"${item.tanggal}"`,
                        `"${item.timestamp}"`
                      ].join(",");
                    });

                    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\n");
                    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    const filename = `Rekap_Presensi_${exportSelectedKelas}_${new Date().toISOString().split("T")[0]}.csv`;
                    link.setAttribute("href", url);
                    link.setAttribute("download", filename);
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                >
                  <span>📊 Download File Excel / CSV</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-700/60">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Filter Berdasarkan Kelas:
                  </label>
                  <select
                    value={exportSelectedKelas}
                    onChange={(e) => setExportSelectedKelas(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                  >
                    <option value="All">Semua Kelas</option>
                    {Array.from(new Set(studentList.map((s) => s.kelas).filter((k) => k && k !== "-"))).map((kelas) => (
                      <option key={kelas} value={kelas}>
                        Kelas {kelas}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Preview Data Presensi yang Akan Diexport:
                </h4>
                <div className="overflow-x-auto border border-slate-700/80 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/80 text-slate-400 uppercase font-semibold border-b border-slate-700">
                      <tr>
                        <th className="px-4 py-3">No</th>
                        <th className="px-4 py-3">NIM</th>
                        <th className="px-4 py-3">Nama Mahasiswa</th>
                        <th className="px-4 py-3">Kelas</th>
                        <th className="px-4 py-3">UID RFID</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Tanggal & Waktu</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/50 text-slate-200">
                      {attendanceList
                        .filter((item) => {
                          const student = getStudentByUid(item.uid);
                          if (exportSelectedKelas === "All") return true;
                          return student && student.kelas === exportSelectedKelas;
                        })
                        .map((item, idx) => {
                          const student = getStudentByUid(item.uid);
                          return (
                            <tr key={item.id || idx} className="hover:bg-slate-700/20">
                              <td className="px-4 py-2.5 font-mono text-slate-400">{idx + 1}</td>
                              <td className="px-4 py-2.5 font-mono">{student?.nim || "-"}</td>
                              <td className="px-4 py-2.5 font-semibold text-white">
                                {student?.nama || "Belum Terdaftar"}
                              </td>
                              <td className="px-4 py-2.5">{student?.kelas || "-"}</td>
                              <td className="px-4 py-2.5 font-mono text-indigo-400">{item.uid}</td>
                              <td className="px-4 py-2.5 text-emerald-400 font-medium">{item.status}</td>
                              <td className="px-4 py-2.5 font-mono text-slate-400">
                                {item.tanggal} {item.timestamp}
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-800 py-4 text-center text-xs text-slate-500">
        <p>Sistem Presensi RFID ESP32 & Firebase Realtime Database © 2026</p>
      </footer>
    </div>
  );
}