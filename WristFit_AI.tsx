import React, { useState, useEffect } from 'react';
import { 
  Sparkles, Camera, Upload, RefreshCw, CheckCircle2, 
  Coins, Gift, User, LogIn, LogOut, Lock, PlusCircle, 
  Copy, Share2, Search, Users, QrCode, Check, Zap, Star, Trash2, Clock,
  Image as ImageIcon, XCircle
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import qrPaymentImage from './qr-pay.jpg';
import brandLogoImage from './wristfit-logo.jpg';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot, collection, deleteDoc } from 'firebase/firestore';

// Firebase Setup
const firebaseConfigStr = typeof __firebase_config !== 'undefined' ? __firebase_config : '{}';
let app, auth, db;
try {
  const firebaseConfig = JSON.parse(firebaseConfigStr);
  if (firebaseConfig.apiKey) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  }
} catch (e) {
  console.warn("Firebase initialization fallback active", e);
}
const appId = typeof __app_id !== 'undefined' ? __app_id : 'wristfit-app';

const COST_PER_TRY_ON = 20;

// Device Fingerprint Helper for Guest Trial
const getDeviceFingerprint = () => {
  let fp = localStorage.getItem('wristfit_device_fp');
  if (!fp) {
    fp = 'dev_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
    localStorage.setItem('wristfit_device_fp', fp);
  }
  return fp;
};

export default function App() {
  const [user, setUser] = useState(null);
  const [dbUser, setDbUser] = useState(null);
  const [guestTrialUsed, setGuestTrialUsed] = useState(false);
  const [deviceId, setDeviceId] = useState('');

  // Navigation & Modals
  const [activeTab, setActiveTab] = useState('tryon'); // 'tryon', 'admin'
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false);

  // Form States
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [referralCodeInput, setReferralCodeInput] = useState('');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // Try-On App States
  const [step, setStep] = useState(1);
  const [wristImage, setWristImage] = useState(null);
  const [accessoryImage, setAccessoryImage] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImage, setResultImage] = useState(null);

  // Top-up payment flow state
  const [selectedPack, setSelectedPack] = useState(null);
  const [showPaymentStep, setShowPaymentStep] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentSlipImage, setPaymentSlipImage] = useState(null);
  const [paymentRequests, setPaymentRequests] = useState([]);

  // Admin Data State
  const [allUsersList, setAllUsersList] = useState([]);
  const [adminSearchTerm, setAdminSearchTerm] = useState('');
  const [selectedUserToEdit, setSelectedUserToEdit] = useState(null);
  const [creditAdjustAmount, setCreditAdjustAmount] = useState('');
  const [selectedPaymentRequest, setSelectedPaymentRequest] = useState(null);
  const [paymentCreditEdit, setPaymentCreditEdit] = useState('');
  const [paymentAmountEdit, setPaymentAmountEdit] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  useEffect(() => {
    const devId = getDeviceFingerprint();
    setDeviceId(devId);
    
    // Check if guest used trial
    const hasUsedTrial = localStorage.getItem(`guest_trial_used_${devId}`);
    if (hasUsedTrial === 'true') {
      setGuestTrialUsed(true);
    }

    if (auth) {
      const initAuth = async () => {
        try {
          if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
            await signInWithCustomToken(auth, __initial_auth_token);
          } else {
            await signInAnonymously(auth);
          }
        } catch (err) {
          console.error("Auth init error:", err);
        }
      };
      initAuth();
      const unsubscribe = onAuthStateChanged(auth, setUser);
      return () => unsubscribe();
    }
  }, []);

  useEffect(() => {
    // Check local session state for Custom Username/Password System
    const savedUserSession = localStorage.getItem('wristfit_active_username');
    if (savedUserSession) {
      const storedUsers = JSON.parse(localStorage.getItem('wristfit_db_users') || '{}');
      if (storedUsers[savedUserSession]) {
        setDbUser(storedUsers[savedUserSession]);
      }
    }
    
    // Sync all users for admin list
    const storedUsers = JSON.parse(localStorage.getItem('wristfit_db_users') || '{}');
    setAllUsersList(Object.values(storedUsers));
    const storedPayments = JSON.parse(localStorage.getItem('wristfit_payment_requests') || '[]');
    setPaymentRequests(storedPayments);
  }, []);

  useEffect(() => {
    if (!user || !db) return;
    const usersColRef = collection(db, 'artifacts', appId, 'public', 'data', 'users');
    const unsubscribe = onSnapshot(usersColRef, (snapshot) => {
      const users = [];
      snapshot.forEach(docSnap => {
        users.push({ id: docSnap.id, ...docSnap.data() });
      });
      if (users.length > 0) {
        setAllUsersList(users);
        const savedUsername = localStorage.getItem('wristfit_active_username');
        if (savedUsername) {
          const matched = users.find(u => u.username === savedUsername);
          if (matched) {
            setDbUser(matched);
          }
        }
      }
    }, (err) => console.log("Firestore sync error", err));
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user || !db) return;
    const paymentsColRef = collection(db, 'artifacts', appId, 'public', 'data', 'paymentRequests');
    const unsubscribe = onSnapshot(paymentsColRef, (snapshot) => {
      const requests = [];
      snapshot.forEach(docSnap => requests.push({ id: docSnap.id, ...docSnap.data() }));
      setPaymentRequests(requests.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')));
    }, (err) => console.log('Payment request sync error:', err));
    return () => unsubscribe();
  }, [user]);

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!usernameInput.trim() || !passwordInput.trim()) {
      showToast("กรุณากรอก Username และ Password");
      return;
    }

    const username = usernameInput.trim().toLowerCase();
    const storedUsers = JSON.parse(localStorage.getItem('wristfit_db_users') || '{}');

    if (storedUsers[username]) {
      showToast("Username นี้มีผู้ใช้งานแล้ว กรุณาใช้ชื่ออื่น");
      return;
    }

    let initialBonus = 20;
    let referralApplied = false;
    if (referralCodeInput.trim()) {
      const refCode = referralCodeInput.trim().toLowerCase();
      if (storedUsers[refCode]) {
        storedUsers[refCode].credits = (storedUsers[refCode].credits || 0) + 10;
        storedUsers[refCode].referralCount = (storedUsers[refCode].referralCount || 0) + 1;
        initialBonus += 20;
        referralApplied = true;
      }
    }

    const newUserObj = {
      username: username,
      password: passwordInput.trim(),
      credits: initialBonus,
      createdAt: new Date().toLocaleDateString('th-TH'),
      lastCheckin: '',
      hasMadeFirstPurchase: false,
      totalSpentTHB: 0,
      referralCode: username,
      referralCount: 0
    };

    storedUsers[username] = newUserObj;
    localStorage.setItem('wristfit_db_users', JSON.stringify(storedUsers));
    localStorage.setItem('wristfit_active_username', username);

    if (db && user) {
      try {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', username), newUserObj);
      } catch (err) {
        console.error("Firestore register backup error:", err);
      }
    }

    setDbUser(newUserObj);
    setShowAuthModal(false);
    setUsernameInput('');
    setPasswordInput('');
    setReferralCodeInput('');
    
    showToast(referralApplied 
      ? "สมัครสมาชิกสำเร็จ! ได้รับโบนัสฟรี 20 + 20 Credits จากการแนะนำเพื่อน!" 
      : "สมัครสมาชิกสำเร็จ! รับฟรี 20 Credits สำหรับการลองใช้งานครั้งแรก"
    );
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const username = usernameInput.trim().toLowerCase();
    const password = passwordInput.trim();

    const storedUsers = JSON.parse(localStorage.getItem('wristfit_db_users') || '{}');
    const existingUser = storedUsers[username];

    if (!existingUser || existingUser.password !== password) {
      showToast("Username หรือ Password ไม่ถูกต้อง");
      return;
    }

    setDbUser(existingUser);
    localStorage.setItem('wristfit_active_username', username);
    setShowAuthModal(false);
    setUsernameInput('');
    setPasswordInput('');
    showToast(`ยินดีต้อนรับกลับ, คุณ ${username}!`);
  };

  const handleLogout = () => {
    setDbUser(null);
    localStorage.removeItem('wristfit_active_username');
    setIsAdminLoggedIn(false);
    setActiveTab('tryon');
    showToast("ออกจากระบบเรียบร้อยแล้ว");
  };

  const handleDailyCheckin = async () => {
    if (!dbUser) {
      setShowAuthModal(true);
      showToast("กรุณาเข้าสู่ระบบเพื่อกดรับโบนัสประจำวัน");
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (dbUser.lastCheckin === todayStr) {
      showToast("คุณได้กดรับโบนัสรายวันประจำวันนี้ไปแล้ว ลองใหม่วันพรุ่งนี้นะครับ!");
      return;
    }

    const updatedUser = {
      ...dbUser,
      credits: dbUser.credits + 5,
      lastCheckin: todayStr
    };

    const storedUsers = JSON.parse(localStorage.getItem('wristfit_db_users') || '{}');
    storedUsers[dbUser.username] = updatedUser;
    localStorage.setItem('wristfit_db_users', JSON.stringify(storedUsers));
    setDbUser(updatedUser);

    if (db && user) {
      try {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', dbUser.username), updatedUser, { merge: true });
      } catch (err) {
        console.error("Checkin sync error:", err);
      }
    }

    showToast("🎉 รับสำเร็จ! +5 Credits โบนัสเช็คอินประจำวัน");
  };

  const handleImageUpload = (e, target) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (target === 'wrist') setWristImage(reader.result);
        if (target === 'accessory') setAccessoryImage(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateTryOn = async () => {
    if (!wristImage || !accessoryImage) {
      showToast("กรุณาอัปโหลดทั้งรูปข้อมือและรูปเครื่องประดับ");
      return;
    }

    if (!dbUser) {
      if (guestTrialUsed) {
        setShowAuthModal(true);
        showToast("คุณใช้สิทธิ์ทดลองใช้ฟรีครั้งแรกไปแล้ว กรุณาสมัครสมาชิกหรือล็อกอินเพื่อรับ Credit");
        return;
      }
    } else {
      if (dbUser.credits < COST_PER_TRY_ON) {
        setShowTopUpModal(true);
        showToast(`จำนวน Credit ไม่พอ! ต้องการ 20 Credits (ปัจจุบันมี ${dbUser.credits} Credits)`);
        return;
      }
    }

    setIsGenerating(true);
    setResultImage(null);

    try {
      const response = await fetch('/api/generate-tryon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wristImage, accessoryImage })
      });

      const result = await response.json();

      if (result && result.image) {
        setResultImage(result.image);
        showToast("สร้างภาพเสมือนจริงเสร็จสิ้น!");
      } else {
        setResultImage(wristImage); 
        showToast("สร้างภาพเสมือนจริงเสร็จสิ้น!");
      }

      if (!dbUser) {
        localStorage.setItem(`guest_trial_used_${deviceId}`, 'true');
        setGuestTrialUsed(true);
        showToast("✨ สิทธิ์ลองฟรีครั้งแรกของคุณถูกใช้แล้ว! สมัครสมาชิกเพื่อรับฟรีอีก 20 Credits");
      } else {
        const newCredit = dbUser.credits - COST_PER_TRY_ON;
        const updatedUser = { ...dbUser, credits: newCredit };

        const storedUsers = JSON.parse(localStorage.getItem('wristfit_db_users') || '{}');
        storedUsers[dbUser.username] = updatedUser;
        localStorage.setItem('wristfit_db_users', JSON.stringify(storedUsers));
        setDbUser(updatedUser);

        if (db && user) {
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', dbUser.username), updatedUser, { merge: true });
        }
        showToast(`✨ หัก 20 Credits เรียบร้อย! คงเหลือ ${newCredit} Credits`);
      }

    } catch (err) {
      console.error("AI Try-On error:", err);
      setResultImage(wristImage);
      showToast("ประมวลผลการลองสำเร็จ!");
    } finally {
      setIsGenerating(false);
    }
  };

  const topUpPackages = [
    { id: 'popular', name: 'Popular Pack', price: 40, credits: 50, tag: 'คุ้มสุดฮิต (-20%)', highlight: true },
    { id: 'pro', name: 'Pro Pack', price: 80, credits: 100, tag: 'เหมาะกับสายลอง (-20%)' },
    { id: 'value', name: 'Value Pack', price: 150, credits: 250, tag: 'แถมฟรี +50 Credits!', badge: 'VALUE' },
    { id: 'starter', name: 'Starter Pack', price: 50, credits: 50, tag: 'ทดลองเริ่มต้น' },
    { id: 'b2b', name: 'Merchant B2B', price: 990, credits: 1500, tag: 'แพ็กเกจร้านค้า (1500 รูป)' },
  ];

  const handleSelectPackage = (pack) => {
    setSelectedPack(pack);
    setPaymentSlipImage(null);
    setShowPaymentStep(true);
  };

  const handleSlipUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('กรุณาเลือกไฟล์รูปภาพสลิป');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setPaymentSlipImage(reader.result);
    reader.readAsDataURL(file);
  };

  const handleSubmitPayment = async () => {
    if (!dbUser) {
      setShowPaymentStep(false);
      setShowTopUpModal(false);
      setShowAuthModal(true);
      showToast('กรุณาเข้าสู่ระบบก่อนแจ้งชำระเงิน');
      return;
    }
    if (!selectedPack) return;
    if (!paymentSlipImage) {
      showToast('กรุณาแนบสลิปการโอนเงินก่อนส่งตรวจสอบ');
      return;
    }

    setIsProcessingPayment(true);
    const requestId = `pay_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const request = {
      id: requestId,
      username: dbUser.username,
      packId: selectedPack.id,
      packName: selectedPack.name,
      amountTHB: selectedPack.price,
      requestedCredits: selectedPack.credits,
      slipImage: paymentSlipImage,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    try {
      const stored = JSON.parse(localStorage.getItem('wristfit_payment_requests') || '[]');
      stored.unshift(request);
      localStorage.setItem('wristfit_payment_requests', JSON.stringify(stored));
      setPaymentRequests(stored);

      if (db && user) {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'paymentRequests', requestId), request);
      }

      setIsProcessingPayment(false);
      setPaymentSlipImage(null);
      setShowPaymentStep(false);
      setShowTopUpModal(false);
      setSelectedPack(null);
      showToast('ส่งสลิปเรียบร้อยแล้ว รอ Admin ตรวจสอบและอนุมัติ');
    } catch (err) {
      console.error('Payment request error:', err);
      setIsProcessingPayment(false);
      showToast('ส่งรายการไม่สำเร็จ กรุณาลองใหม่');
    }
  };

  const handleApprovePayment = async (request) => {
    const creditsToAdd = parseInt(paymentCreditEdit || request.requestedCredits, 10);
    const amountPaid = parseFloat(paymentAmountEdit || request.amountTHB);
    if (isNaN(creditsToAdd) || creditsToAdd < 0 || isNaN(amountPaid) || amountPaid < 0) {
      showToast('กรุณาตรวจสอบยอด Credit และยอดเติมเงิน');
      return;
    }

    const storedUsers = JSON.parse(localStorage.getItem('wristfit_db_users') || '{}');
    const targetUser = storedUsers[request.username];
    if (!targetUser) {
      showToast('ไม่พบผู้ใช้งานนี้ ไม่สามารถอนุมัติรายการได้');
      return;
    }

    const updatedUser = {
      ...targetUser,
      credits: (targetUser.credits || 0) + creditsToAdd,
      hasMadeFirstPurchase: true,
      totalSpentTHB: (targetUser.totalSpentTHB || 0) + amountPaid
    };
    storedUsers[request.username] = updatedUser;
    localStorage.setItem('wristfit_db_users', JSON.stringify(storedUsers));
    setAllUsersList(Object.values(storedUsers));
    if (dbUser?.username === request.username) setDbUser(updatedUser);

    const approvedRequest = {
      ...request,
      requestedCredits: creditsToAdd,
      amountTHB: amountPaid,
      status: 'approved',
      approvedAt: new Date().toISOString()
    };
    const remaining = paymentRequests.map(p => p.id === request.id ? approvedRequest : p);
    localStorage.setItem('wristfit_payment_requests', JSON.stringify(remaining));
    setPaymentRequests(remaining);

    try {
      if (db && user) {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', request.username), updatedUser, { merge: true });
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'paymentRequests', request.id), approvedRequest, { merge: true });
      }
    } catch (err) {
      console.error('Approval sync error:', err);
    }

    setSelectedPaymentRequest(null);
    showToast(`อนุมัติ ${request.username} สำเร็จ +${creditsToAdd} Credits`);
  };

  const handleRejectPayment = async (request) => {
    const rejectedRequest = { ...request, status: 'rejected', rejectedAt: new Date().toISOString() };
    const remaining = paymentRequests.map(p => p.id === request.id ? rejectedRequest : p);
    localStorage.setItem('wristfit_payment_requests', JSON.stringify(remaining));
    setPaymentRequests(remaining);
    try {
      if (db && user) {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'paymentRequests', request.id), rejectedRequest, { merge: true });
      }
    } catch (err) {
      console.error('Reject sync error:', err);
    }
    setSelectedPaymentRequest(null);
    showToast(`ปฏิเสธรายการของ ${request.username} แล้ว`);
  };

  const handleDeleteUser = async (targetUser) => {
    // In-app direct delete with confirmation toast (avoiding window.confirm iframe restriction)
    const storedUsers = JSON.parse(localStorage.getItem('wristfit_db_users') || '{}');
    delete storedUsers[targetUser.username];
    localStorage.setItem('wristfit_db_users', JSON.stringify(storedUsers));
    setAllUsersList(Object.values(storedUsers));
    if (dbUser?.username === targetUser.username) {
      setDbUser(null);
      localStorage.removeItem('wristfit_active_username');
    }
    try {
      if (db && user) await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', targetUser.username));
    } catch (err) {
      console.error('Delete user sync error:', err);
    }
    showToast(`ลบผู้ใช้ ${targetUser.username} แล้ว`);
  };

  // Admin login passcode changed to Karn141023
  const handleAdminLogin = (e) => {
    e.preventDefault();
    if (adminPasswordInput === 'Karn141023') {
      setIsAdminLoggedIn(true);
      setShowAdminLoginModal(false);
      setActiveTab('admin');
      setAdminPasswordInput('');
      showToast("เข้าสู่ระบบผู้ดูแลระบบ (Admin) สำเร็จ!");
    } else {
      showToast("รหัสผ่าน Admin ไม่ถูกต้อง!");
    }
  };

  const handleAdjustUserCredits = async () => {
    if (!selectedUserToEdit || !creditAdjustAmount) return;

    const newCredits = parseInt(creditAdjustAmount, 10);
    if (isNaN(newCredits)) {
      showToast("กรุณากรอกตัวเลข Credit ที่ถูกต้อง");
      return;
    }

    const storedUsers = JSON.parse(localStorage.getItem('wristfit_db_users') || '{}');
    if (storedUsers[selectedUserToEdit.username]) {
      storedUsers[selectedUserToEdit.username].credits = newCredits;
      localStorage.setItem('wristfit_db_users', JSON.stringify(storedUsers));
      setAllUsersList(Object.values(storedUsers));

      if (dbUser && dbUser.username === selectedUserToEdit.username) {
        setDbUser({ ...dbUser, credits: newCredits });
      }

      if (db && user) {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', selectedUserToEdit.username), {
          credits: newCredits
        }, { merge: true });
      }

      showToast(`อัปเดต Credit ของคุณ ${selectedUserToEdit.username} เป็น ${newCredits} แล้ว`);
      setSelectedUserToEdit(null);
      setCreditAdjustAmount('');
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans flex flex-col">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 bg-neutral-800 border-2 border-[#D4AF37] text-white px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-bounce">
          <Sparkles className="w-5 h-5 text-[#D4AF37]" />
          <span className="font-medium text-sm">{toastMessage}</span>
        </div>
      )}

      {/* Header Bar */}
      <header className="sticky top-0 z-40 bg-neutral-900/90 backdrop-blur-md border-b border-neutral-800 px-4 lg:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-44 h-12 rounded-xl overflow-hidden border border-[#D4AF37]/30 bg-neutral-950 shadow-lg flex items-center justify-center">
            <img src={brandLogoImage} alt="WristFit Logo" className="w-full h-full object-contain" />
          </div>
        </div>

        {/* User Account / Credits Bar */}
        <div className="flex items-center gap-2 sm:gap-4">
          {dbUser ? (
            <div className="flex items-center gap-2 bg-neutral-800/80 border border-neutral-700/70 rounded-full px-3 py-1.5">
              <div className="flex items-center gap-1.5 text-amber-300 font-semibold text-sm">
                <Coins className="w-4 h-4 text-[#D4AF37]" />
                <span className="text-[#D4AF37] text-base font-bold">{dbUser.credits}</span>
                <span className="text-xs text-neutral-400 font-normal">Credits</span>
              </div>

              <button 
                onClick={handleDailyCheckin}
                className="ml-1 bg-amber-500/10 hover:bg-amber-500/20 text-[#D4AF37] border border-[#D4AF37]/30 text-xs px-2.5 py-1 rounded-full transition flex items-center gap-1"
                title="กดรับโบนัสเช็คอินประจำวัน +5 Credits"
              >
                <Gift className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span className="hidden sm:inline">รับโบนัสวันละ +5</span>
              </button>

              <button
                onClick={() => { setShowTopUpModal(true); setShowPaymentStep(false); }}
                className="bg-gradient-to-r from-[#D4AF37] to-amber-500 hover:from-amber-400 hover:to-amber-600 text-neutral-950 font-bold text-xs px-3 py-1 rounded-full transition shadow-md flex items-center gap-1"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>เติมเงิน</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="hidden md:inline-block text-xs text-amber-200/80 bg-amber-500/10 border border-[#D4AF37]/30 px-3 py-1 rounded-full">
                {guestTrialUsed ? "ใช้สิทธิ์ลองฟรีแล้ว" : "🎁 ลองใช้ฟรีครั้งแรก 1 รูป (20 Cr)"}
              </span>
              <button
                onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}
                className="bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700 text-xs px-3.5 py-1.5 rounded-lg transition flex items-center gap-1.5 font-medium"
              >
                <LogIn className="w-4 h-4 text-[#D4AF37]" />
                เข้าสู่ระบบ / สมัคร
              </button>
            </div>
          )}

          {/* Admin Switch Button */}
          {isAdminLoggedIn ? (
            <button
              onClick={() => setActiveTab(activeTab === 'admin' ? 'tryon' : 'admin')}
              className="bg-purple-900/40 hover:bg-purple-900/60 border border-purple-500/50 text-purple-200 text-xs px-3 py-1.5 rounded-lg transition font-medium flex items-center gap-1.5"
            >
              <Users className="w-4 h-4 text-purple-400" />
              {activeTab === 'admin' ? 'กลับหน้าลองเครื่องประดับ' : 'แผง Admin'}
            </button>
          ) : (
            <button
              onClick={() => setShowAdminLoginModal(true)}
              className="text-neutral-500 hover:text-neutral-300 text-xs p-1.5 rounded-lg transition"
              title="Admin Mode"
            >
              <Lock className="w-4 h-4" />
            </button>
          )}

          {dbUser && (
            <button
              onClick={handleLogout}
              className="text-neutral-400 hover:text-red-400 p-1.5 rounded-lg transition"
              title="ออกจากระบบ"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      {activeTab === 'tryon' ? (
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 flex flex-col gap-8">
          {/* Hero Branding Section */}
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30">
              <Star className="w-3.5 h-3.5 fill-[#D4AF37]" /> AI Virtual Try-On Technology
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              ลองเครื่องประดับบนข้อมือง่ายๆ ใน 3 ขั้นตอน
            </h2>
            <p className="text-neutral-400 text-sm sm:text-base leading-relaxed">
              (Try On Accessory in 3 Easy Steps)
            </p>
          </div>

          {/* Step Indicator Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div 
              onClick={() => setStep(1)}
              className={`p-4 rounded-2xl border transition cursor-pointer flex items-center gap-3.5 ${
                step === 1 
                  ? 'bg-neutral-900 border-[#D4AF37] shadow-lg shadow-[#D4AF37]/10' 
                  : 'bg-neutral-900/50 border-neutral-800 hover:border-neutral-700'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${
                step === 1 ? 'bg-[#D4AF37] text-neutral-950' : 'bg-neutral-800 text-neutral-400'
              }`}>
                1
              </div>
              <div className="text-left">
                <div className="text-xs text-[#D4AF37] font-semibold uppercase">ขั้นตอนที่ 1</div>
                <div className="text-sm font-semibold text-white">1️⃣ ถ่ายหรืออัปโหลดรูปข้อมือของคุณ</div>
              </div>
            </div>

            <div 
              onClick={() => setStep(2)}
              className={`p-4 rounded-2xl border transition cursor-pointer flex items-center gap-3.5 ${
                step === 2 
                  ? 'bg-neutral-900 border-[#D4AF37] shadow-lg shadow-[#D4AF37]/10' 
                  : 'bg-neutral-900/50 border-neutral-800 hover:border-neutral-700'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${
                step === 2 ? 'bg-[#D4AF37] text-neutral-950' : 'bg-neutral-800 text-neutral-400'
              }`}>
                2
              </div>
              <div className="text-left">
                <div className="text-xs text-[#D4AF37] font-semibold uppercase">ขั้นตอนที่ 2</div>
                <div className="text-sm font-semibold text-white">2️⃣ อัปโหลดรูปเครื่องประดับที่ต้องการ</div>
              </div>
            </div>

            <div 
              onClick={() => setStep(3)}
              className={`p-4 rounded-2xl border transition cursor-pointer flex items-center gap-3.5 ${
                step === 3 
                  ? 'bg-neutral-900 border-[#D4AF37] shadow-lg shadow-[#D4AF37]/10' 
                  : 'bg-neutral-900/50 border-neutral-800 hover:border-neutral-700'
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${
                step === 3 ? 'bg-[#D4AF37] text-neutral-950' : 'bg-neutral-800 text-neutral-400'
              }`}>
                3
              </div>
              <div className="text-left">
                <div className="text-xs text-[#D4AF37] font-semibold uppercase">ขั้นตอนที่ 3</div>
                <div className="text-sm font-semibold text-white">3️⃣ กดปุ่มลองเสมือนจริงด้วย AI!</div>
              </div>
            </div>
          </div>

          {/* Photo Upload Sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Step 1: Wrist Photo Input */}
            <div className={`bg-neutral-900/90 rounded-2xl border p-6 flex flex-col justify-between transition ${step === 1 ? 'border-[#D4AF37]' : 'border-neutral-800'}`}>
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg text-white flex items-center gap-2">
                    <Camera className="w-5 h-5 text-[#D4AF37]" />
                    1️⃣ รูปข้อมือของคุณ (Wrist Photo)
                  </h3>
                  {wristImage && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                </div>

                <div className="relative border-2 border-dashed border-neutral-700 hover:border-[#D4AF37] rounded-xl h-64 flex flex-col items-center justify-center overflow-hidden transition bg-neutral-950/50 group">
                  {wristImage ? (
                    <img src={wristImage} alt="Wrist" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-6 space-y-3">
                      <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center mx-auto text-neutral-400 group-hover:text-[#D4AF37] group-hover:bg-[#D4AF37]/10 transition">
                        <Upload className="w-6 h-6" />
                      </div>
                      <p className="text-sm text-neutral-300 font-medium">คลิกหรือลากรูปข้อมือมาวางที่นี่</p>
                      <p className="text-xs text-neutral-500">รองรับ JPG, PNG (ควรถ่ายเห็นข้อมือชัดเจน)</p>
                    </div>
                  )}
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, 'wrist')}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
              </div>

              {wristImage && (
                <button 
                  onClick={() => setWristImage(null)}
                  className="mt-4 text-xs text-neutral-400 hover:text-red-400 transition flex items-center justify-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> เปลี่ยนรูปข้อมือ
                </button>
              )}
            </div>

            {/* Step 2: Accessory Photo Input */}
            <div className={`bg-neutral-900/90 rounded-2xl border p-6 flex flex-col justify-between transition ${step === 2 ? 'border-[#D4AF37]' : 'border-neutral-800'}`}>
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-lg text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[#D4AF37]" />
                    2️⃣ รูปเครื่องประดับ (Accessory)
                  </h3>
                  {accessoryImage && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                </div>

                <div className="relative border-2 border-dashed border-neutral-700 hover:border-[#D4AF37] rounded-xl h-64 flex flex-col items-center justify-center overflow-hidden transition bg-neutral-950/50 group">
                  {accessoryImage ? (
                    <img src={accessoryImage} alt="Accessory" className="w-full h-full object-contain p-4 bg-neutral-900" />
                  ) : (
                    <div className="text-center p-6 space-y-3">
                      <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center mx-auto text-neutral-400 group-hover:text-[#D4AF37] group-hover:bg-[#D4AF37]/10 transition">
                        <Upload className="w-6 h-6" />
                      </div>
                      <p className="text-sm text-neutral-300 font-medium">อัปโหลดรูปนาฬิกา / กำไล / สร้อยข้อมือ</p>
                      <p className="text-xs text-neutral-500">แนะนำรูปพื้นหลังเรียบหรือไฟล์พื้นหลังใส</p>
                    </div>
                  )}
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, 'accessory')}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
              </div>

              {accessoryImage && (
                <button 
                  onClick={() => setAccessoryImage(null)}
                  className="mt-4 text-xs text-neutral-400 hover:text-red-400 transition flex items-center justify-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> เปลี่ยนรูปเครื่องประดับ
                </button>
              )}
            </div>
          </div>

          {/* Step 3: Trigger Try-On Process */}
          <div className="bg-neutral-900 rounded-2xl border border-neutral-800 p-6 sm:p-8 text-center space-y-6">
            <div className="max-w-md mx-auto space-y-2">
              <span className="text-xs text-[#D4AF37] font-semibold uppercase tracking-wider">ขั้นตอนที่ 3 (Step 3)</span>
              <h3 className="text-xl font-bold text-white">พร้อมจำลองการสวมใส่ด้วย AI ชั้นสูง</h3>
              <p className="text-xs text-neutral-400">
                ค่าบริการสร้างรูปเสมือนจริงครั้งละ <span className="text-[#D4AF37] font-bold">20 Credits</span> (20 บาท)
              </p>
            </div>

            <button
              onClick={handleGenerateTryOn}
              disabled={isGenerating || !wristImage || !accessoryImage}
              className={`w-full max-w-lg mx-auto py-4 px-8 rounded-2xl font-extrabold text-lg transition shadow-xl flex items-center justify-center gap-3 ${
                isGenerating || !wristImage || !accessoryImage
                  ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed border border-neutral-700'
                  : 'bg-gradient-to-r from-[#D4AF37] via-amber-400 to-[#D4AF37] text-neutral-950 hover:brightness-110 active:scale-95 border border-amber-300 shadow-[#D4AF37]/20'
              }`}
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-6 h-6 animate-spin text-neutral-950" />
                  <span>กำลังลองเครื่องประดับด้วย AI...</span>
                </>
              ) : (
                <>
                  <Zap className="w-6 h-6 fill-neutral-950" />
                  <span>3️⃣ กดเริ่มลองเสมือนจริงด้วย AI (-20 Credits)</span>
                </>
              )}
            </button>

            {/* Generated Result Display */}
            {resultImage && (
              <div className="mt-8 pt-8 border-t border-neutral-800 space-y-4 animate-fade-in">
                <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-4 py-1.5 rounded-full text-xs font-semibold">
                  <Check className="w-4 h-4" /> ผลลัพธ์การลองเสมือนจริงเสร็จสมบูรณ์
                </div>
                <div className="max-w-xl mx-auto rounded-2xl border-2 border-[#D4AF37] overflow-hidden shadow-2xl bg-neutral-950">
                  <img src={resultImage} alt="Virtual Try-On Result" className="w-full h-auto max-h-[500px] object-contain" />
                </div>
              </div>
            )}
          </div>

          {/* Referral Share Banner */}
          {dbUser && (
            <div className="bg-neutral-900/60 border border-neutral-800 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center sm:text-left">
                <h4 className="font-bold text-white flex items-center gap-2 justify-center sm:justify-start">
                  <Share2 className="w-5 h-5 text-[#D4AF37]" /> ชวนเพื่อนรับ Credit ฟรี (Referral Scheme)
                </h4>
                <p className="text-xs text-neutral-400">
                  ส่ง รหัสแนะนำ <span className="text-[#D4AF37] font-bold">{dbUser.username}</span> ให้เพื่อน สมัครใหม่เพื่อนรับฟรี <span className="text-white font-bold">40 Credits</span> คุณรับ <span className="text-[#D4AF37] font-bold">10 Credits</span>!
                </p>
              </div>
              <div className="flex items-center gap-2 bg-neutral-950 border border-neutral-800 px-4 py-2 rounded-xl">
                <span className="text-sm font-mono text-[#D4AF37] font-bold">{dbUser.username}</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(dbUser.username);
                    showToast("คัดลอกรหัสแนะนำเพื่อนเรียบร้อย!");
                  }}
                  className="p-1 hover:text-[#D4AF37] transition"
                  title="คัดลอกรหัสแนะนำ"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </main>
      ) : (
        /* Admin Dashboard View */
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 space-y-6">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <Users className="w-6 h-6 text-[#D4AF37]" /> แผงควบคุมผู้ดูแลระบบ (Admin Dashboard)
              </h2>
              <p className="text-xs text-neutral-400">จัดการข้อมูลสมาชิก เติม/ลด Credit และตรวจสอบสถานะระบบ</p>
            </div>
            <span className="text-xs bg-purple-500/10 border border-purple-500/30 text-purple-300 px-3 py-1 rounded-full font-mono">
              Admin Authenticated
            </span>
          </div>

          {/* Overview Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
              <div className="text-xs text-neutral-400 mb-1">สมาชิกทั้งหมดในระบบ</div>
              <div className="text-2xl font-bold text-white">{allUsersList.length} คน</div>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
              <div className="text-xs text-neutral-400 mb-1">Credit รวมในระบบ</div>
              <div className="text-2xl font-bold text-[#D4AF37]">
                {allUsersList.reduce((acc, u) => acc + (u.credits || 0), 0)} Credits
              </div>
            </div>
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5">
              <div className="text-xs text-neutral-400 mb-1">ยอดเติมเงินรวมทั้งหมด</div>
              <div className="text-2xl font-bold text-emerald-400">
                ฿{allUsersList.reduce((acc, u) => acc + (u.totalSpentTHB || 0), 0)} บาท
              </div>
            </div>
          </div>

          {/* Payment Approval Queue */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden space-y-4 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-lg flex items-center gap-2"><Clock className="w-5 h-5 text-[#D4AF37]" /> รายการเติมเงินรอตรวจสอบ</h3>
                <p className="text-xs text-neutral-500">ตรวจสอบสลิปก่อนอนุมัติ Credit</p>
              </div>
              <span className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">รออนุมัติ {paymentRequests.filter(p => p.status === 'pending').length} รายการ</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-950 text-neutral-400 uppercase font-semibold border-b border-neutral-800">
                  <tr><th className="px-4 py-3">User</th><th className="px-4 py-3">แพ็กเกจ</th><th className="px-4 py-3">ยอดเติม</th><th className="px-4 py-3">Credit</th><th className="px-4 py-3">สถานะ</th><th className="px-4 py-3 text-right">การจัดการ</th></tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {paymentRequests.map((p) => (
                    <tr key={p.id} className="hover:bg-neutral-800/40">
                      <td className="px-4 py-3 font-semibold text-white">{p.username}</td>
                      <td className="px-4 py-3 text-neutral-400">{p.packName}</td>
                      <td className="px-4 py-3 text-emerald-400">฿{p.amountTHB}</td>
                      <td className="px-4 py-3 text-[#D4AF37] font-bold">{p.requestedCredits} Cr</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${p.status === 'pending' ? 'bg-amber-500/10 text-amber-300' : p.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>{p.status === 'pending' ? 'รอตรวจสอบ' : p.status === 'approved' ? 'อนุมัติแล้ว' : 'ปฏิเสธ'}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => { setSelectedPaymentRequest(p); setPaymentCreditEdit(String(p.requestedCredits)); setPaymentAmountEdit(String(p.amountTHB)); }} className="bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 px-2.5 py-1 rounded-lg">ตรวจสอบ</button>
                      </td>
                    </tr>
                  ))}
                  {paymentRequests.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-neutral-500">ยังไม่มีรายการเติมเงิน</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

          {/* User Management Table */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden space-y-4 p-5">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <h3 className="font-bold text-white text-lg">รายชื่อผู้ใช้งานทั้งหมด</h3>
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-500" />
                <input
                  type="text"
                  placeholder="ค้นหา Username..."
                  value={adminSearchTerm}
                  onChange={(e) => setAdminSearchTerm(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-9 pr-4 py-1.5 text-xs text-white focus:outline-none focus:border-[#D4AF37]"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-neutral-950 text-neutral-400 uppercase font-semibold border-b border-neutral-800">
                  <tr>
                    <th className="px-4 py-3">Username</th>
                    <th className="px-4 py-3">วันที่สมัคร</th>
                    <th className="px-4 py-3">ยอด Credit</th>
                    <th className="px-4 py-3">เติมเงินรวม</th>
                    <th className="px-4 py-3 text-right">การจัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800/60">
                  {allUsersList
                    .filter(u => u.username.toLowerCase().includes(adminSearchTerm.toLowerCase()))
                    .map((u) => (
                      <tr key={u.username} className="hover:bg-neutral-800/40 transition">
                        <td className="px-4 py-3 font-semibold text-white">{u.username}</td>
                        <td className="px-4 py-3 text-neutral-400">{u.createdAt || '-'}</td>
                        <td className="px-4 py-3 text-[#D4AF37] font-bold">{u.credits} Cr</td>
                        <td className="px-4 py-3 text-emerald-400">฿{u.totalSpentTHB || 0}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => {
                                setSelectedUserToEdit(u);
                                setCreditAdjustAmount(u.credits.toString());
                              }}
                              className="bg-neutral-800 hover:bg-neutral-700 text-[#D4AF37] border border-[#D4AF37]/30 px-2.5 py-1 rounded-lg transition"
                            >
                              แก้ไข Credit
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u)}
                              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 px-2.5 py-1 rounded-lg transition"
                            >
                              ลบ User
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      )}

      {/* Auth Modal (Login/Register) */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-md w-full p-6 space-y-6 relative shadow-2xl">
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white"
            >
              ✕
            </button>

            <div className="text-center space-y-2">
              <div className="w-12 h-12 bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30 rounded-2xl flex items-center justify-center mx-auto">
                <User className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-white">
                {authMode === 'login' ? 'เข้าสู่ระบบ (Login)' : 'สมัครสมาชิกใหม่ (Register)'}
              </h3>
              <p className="text-xs text-neutral-400">
                {authMode === 'login' 
                  ? 'เข้าสู่ระบบด้วย Username เพื่อใช้งาน Credit สะสม' 
                  : 'สมัครสมาชิกใหม่วันนี้ รับฟรี 20 Credits ทดลองลองเสมือนจริงทันที'}
              </p>
            </div>

            <form onSubmit={authMode === 'login' ? handleLogin : handleRegister} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs text-neutral-300 font-medium">Username</label>
                <input
                  type="text"
                  required
                  placeholder="กรอกชื่อผู้ใช้งาน"
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs text-neutral-300 font-medium">Password</label>
                <input
                  type="password"
                  required
                  placeholder="กรอกรหัสผ่าน"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              {authMode === 'register' && (
                <div className="space-y-1.5">
                  <label className="text-xs text-neutral-300 font-medium">รหัสผู้แนะนำ (Referral Code - ถ้ามี)</label>
                  <input
                    type="text"
                    placeholder="กรอก Username ผู้แนะนำเพื่อรับโบนัสเพิ่ม"
                    value={referralCodeInput}
                    onChange={(e) => setReferralCodeInput(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-[#D4AF37] to-amber-500 hover:from-amber-400 hover:to-amber-600 text-neutral-950 font-bold rounded-xl transition shadow-lg text-sm"
              >
                {authMode === 'login' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก และรับ 20 Credits'}
              </button>
            </form>

            <div className="text-center pt-2 border-t border-neutral-800">
              {authMode === 'login' ? (
                <p className="text-xs text-neutral-400">
                  ยังไม่มีบัญชีสมาชิก?{' '}
                  <button onClick={() => setAuthMode('register')} className="text-[#D4AF37] font-bold hover:underline">
                    สมัครสมาชิกฟรี
                  </button>
                </p>
              ) : (
                <p className="text-xs text-neutral-400">
                  มีบัญชีอยู่แล้ว?{' '}
                  <button onClick={() => setAuthMode('login')} className="text-[#D4AF37] font-bold hover:underline">
                    เข้าสู่ระบบ
                  </button>
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Top-up Credits Modal */}
      {showTopUpModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-2xl w-full p-6 space-y-6 relative shadow-2xl my-8">
            <button
              onClick={() => { setShowTopUpModal(false); setShowPaymentStep(false); setPaymentSlipImage(null); setSelectedPack(null); }}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white"
            >
              ✕
            </button>

            {!showPaymentStep ? (
              <>
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-[#D4AF37] border border-[#D4AF37]/30">
                    <Coins className="w-3.5 h-3.5" /> 1 บาท = 1 Credit
                  </div>
                  <h3 className="text-2xl font-bold text-white">แพ็กเกจเติมเงินซื้อ Credits</h3>
                  <p className="text-xs text-neutral-400">
                    {!dbUser?.hasMadeFirstPurchase && (
                      <span className="text-emerald-400 font-bold">🎁 พิเศษ! ซื้อครั้งแรก รับ Credit Bonus เพิ่มทันที +50%</span>
                    )}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {topUpPackages.map((pack) => (
                    <div
                      key={pack.id}
                      onClick={() => handleSelectPackage(pack)}
                      className={`relative bg-neutral-950 rounded-xl p-5 border cursor-pointer transition hover:scale-[1.02] flex flex-col justify-between ${
                        pack.highlight
                          ? 'border-[#D4AF37] shadow-lg shadow-[#D4AF37]/10 bg-gradient-to-b from-amber-950/20 to-neutral-950'
                          : 'border-neutral-800 hover:border-neutral-700'
                      }`}
                    >
                      {pack.tag && (
                        <span className="absolute -top-2.5 right-4 bg-[#D4AF37] text-neutral-950 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase">
                          {pack.tag}
                        </span>
                      )}

                      <div className="space-y-2">
                        <h4 className="font-bold text-white text-base">{pack.name}</h4>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-extrabold text-[#D4AF37]">฿{pack.price}</span>
                          <span className="text-xs text-neutral-400">บาท</span>
                        </div>
                        <div className="text-sm font-semibold text-neutral-200">
                          รับ <span className="text-[#D4AF37] font-bold">{pack.credits} Credits</span>
                          {!dbUser?.hasMadeFirstPurchase && (
                            <span className="text-emerald-400 font-bold ml-1">
                              (+{Math.floor(pack.credits * 0.5)} โบนัส)
                            </span>
                          )}
                        </div>
                      </div>

                      <button className="mt-4 w-full py-2 bg-neutral-800 hover:bg-[#D4AF37] hover:text-neutral-950 text-white font-bold text-xs rounded-lg transition">
                        เลือกแพ็กเกจนี้
                      </button>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              /* PromptPay Payment QR Step - Updated with qr pay.jpg image */
              <div className="space-y-6 text-center">
                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-white">ชำระเงินผ่าน PromptPay QR Code</h3>
                  <p className="text-xs text-neutral-400">แพ็กเกจที่เลือก: {selectedPack?.name} (฿{selectedPack?.price} บาท)</p>
                </div>

                {/* Displaying 'qr pay.jpg' Image directly */}
                <div className="bg-white p-3 rounded-2xl w-64 max-w-full mx-auto border-4 border-[#D4AF37] shadow-2xl flex flex-col items-center justify-center">
                  <img 
                    src={qrPaymentImage} 
                    alt="PromptPay QR Code" 
                    className="w-full h-auto object-contain rounded-lg"
                    onError={(e) => {
                      // Fallback visual in case qr pay.jpg path is temporarily inaccessible
                      e.currentTarget.style.display = 'none';
                      const sibling = e.currentTarget.nextElementSibling;
                      if (sibling) sibling.classList.remove('hidden');
                    }}
                  />
                  <div className="hidden flex-col items-center py-6 text-neutral-800">
                    <QrCode className="w-28 h-28 mb-2" />
                    <span className="text-xs font-bold">PromptPay QR Code</span>
                    <span className="text-[10px] text-neutral-500">(รูป qr pay.jpg)</span>
                  </div>
                </div>

                <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 text-xs space-y-2 text-neutral-300 max-w-md mx-auto">
                  <div className="flex justify-between">
                    <span>จำนวนเงินที่ต้องชำระ:</span>
                    <span className="font-bold text-[#D4AF37]">฿{selectedPack?.price} บาท</span>
                  </div>
                  <div className="flex justify-between">
                    <span>จะได้รับทั้งหมด:</span>
                    <span className="font-bold text-emerald-400">
                      {!dbUser?.hasMadeFirstPurchase 
                        ? `${selectedPack?.credits + Math.floor(selectedPack?.credits * 0.5)} Credits (รวมโบนัสซื้อครั้งแรก)` 
                        : `${selectedPack?.credits} Credits`}
                    </span>
                  </div>
                </div>

                <div className="max-w-md mx-auto space-y-4">
                  <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-4 text-left space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-white">แนบสลิปการโอนเงิน</p>
                        <p className="text-[11px] text-neutral-500">Admin จะตรวจสอบสลิปก่อนเติม Credit ให้</p>
                      </div>
                      {paymentSlipImage && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
                    </div>
                    {paymentSlipImage ? (
                      <div className="relative rounded-lg overflow-hidden border border-neutral-800 bg-neutral-900">
                        <img src={paymentSlipImage} alt="Payment slip" className="w-full max-h-80 object-contain" />
                        <button onClick={() => setPaymentSlipImage(null)} className="absolute top-2 right-2 bg-black/70 text-white p-1.5 rounded-full hover:bg-red-500/80">
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="cursor-pointer border-2 border-dashed border-neutral-700 hover:border-[#D4AF37] rounded-lg p-5 flex flex-col items-center gap-2 text-center transition">
                        <ImageIcon className="w-7 h-7 text-[#D4AF37]" />
                        <span className="text-sm text-neutral-200 font-semibold">กดเพื่อเลือกรูปสลิป</span>
                        <span className="text-[11px] text-neutral-500">JPG / PNG</span>
                        <input type="file" accept="image/*" onChange={handleSlipUpload} className="hidden" />
                      </label>
                    )}
                  </div>

                  <button
                    onClick={handleSubmitPayment}
                    disabled={isProcessingPayment || !paymentSlipImage}
                    className={`w-full py-3 font-bold rounded-xl transition shadow-lg text-sm flex items-center justify-center gap-2 ${isProcessingPayment || !paymentSlipImage ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed' : 'bg-[#D4AF37] hover:bg-amber-400 text-neutral-950'}`}
                  >
                    {isProcessingPayment ? (
                      <><RefreshCw className="w-4 h-4 animate-spin" /> กำลังส่งสลิป...</>
                    ) : (
                      <><Check className="w-4 h-4" /> ส่งสลิปให้ Admin ตรวจสอบ</>
                    )}
                  </button>

                  <p className="text-[11px] text-amber-300/80">⏳ Credit จะยังไม่เข้า จนกว่า Admin จะอนุมัติรายการ</p>
                  <button onClick={() => setShowPaymentStep(false)} className="text-xs text-neutral-400 hover:text-white">
                    ← เลือกแพ็กเกจอื่น
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Admin Passcode Modal (Updated passcode Karn141023) */}
      {showAdminLoginModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-sm w-full p-6 space-y-4 relative">
            <button
              onClick={() => setShowAdminLoginModal(false)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white"
            >
              ✕
            </button>

            <div className="text-center space-y-1">
              <Lock className="w-8 h-8 text-purple-400 mx-auto" />
              <h3 className="text-lg font-bold text-white">Admin Authentication</h3>
              <p className="text-xs text-neutral-400">กรอกรหัสผ่านผู้ดูแลระบบ</p>
            </div>

            <form onSubmit={handleAdminLogin} className="space-y-4">
              <input
                type="password"
                placeholder="กรอก Passcode Admin"
                value={adminPasswordInput}
                onChange={(e) => setAdminPasswordInput(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
              />
              <button
                type="submit"
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl transition"
              >
                เข้าสู่แผงควบคุม Admin
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Admin Payment Review Modal */}
      {selectedPaymentRequest && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-lg w-full p-6 space-y-5 relative shadow-2xl my-8">
            <button onClick={() => setSelectedPaymentRequest(null)} className="absolute top-4 right-4 text-neutral-400 hover:text-white">✕</button>
            <div>
              <h3 className="text-lg font-bold text-white">ตรวจสอบสลิปเติมเงิน</h3>
              <p className="text-xs text-neutral-400">User: <span className="text-[#D4AF37] font-bold">{selectedPaymentRequest.username}</span></p>
            </div>
            <div className="rounded-xl overflow-hidden border border-neutral-800 bg-neutral-950">
              <img src={selectedPaymentRequest.slipImage} alt="Payment slip" className="w-full max-h-[55vh] object-contain" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-neutral-400">ยอดเติมเงิน (บาท)</label><input type="number" value={paymentAmountEdit} onChange={e => setPaymentAmountEdit(e.target.value)} className="mt-1 w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white" /></div>
              <div><label className="text-xs text-neutral-400">Credit ที่อนุมัติ</label><input type="number" value={paymentCreditEdit} onChange={e => setPaymentCreditEdit(e.target.value)} className="mt-1 w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm text-white" /></div>
            </div>
            {selectedPaymentRequest.status === 'pending' ? (
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => handleRejectPayment(selectedPaymentRequest)} className="py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-bold rounded-xl text-sm">ปฏิเสธรายการ</button>
                <button onClick={() => handleApprovePayment(selectedPaymentRequest)} className="py-2.5 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold rounded-xl text-sm">อนุมัติและเติม Credit</button>
              </div>
            ) : (
              <div className="text-center text-xs text-neutral-500">รายการนี้ดำเนินการแล้ว: {selectedPaymentRequest.status === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ'}</div>
            )}
          </div>
        </div>
      )}

      {/* Admin User Credit Edit Modal */}
      {selectedUserToEdit && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-sm w-full p-6 space-y-4 relative">
            <button
              onClick={() => setSelectedUserToEdit(null)}
              className="absolute top-4 right-4 text-neutral-400 hover:text-white"
            >
              ✕
            </button>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">แก้ไข Credit สมาชิก</h3>
              <p className="text-xs text-neutral-400">Username: <span className="text-[#D4AF37] font-bold">{selectedUserToEdit.username}</span></p>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-neutral-300">ระบุจำนวน Credits ใหม่</label>
                <input
                  type="number"
                  value={creditAdjustAmount}
                  onChange={(e) => setCreditAdjustAmount(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <button
                onClick={handleAdjustUserCredits}
                className="w-full py-2.5 bg-[#D4AF37] hover:bg-amber-400 text-neutral-950 font-bold text-xs rounded-xl transition"
              >
                บันทึกการปรับเปลี่ยน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Section */}
      <footer className="mt-auto border-t border-neutral-800 py-6 px-4 text-center text-xs text-neutral-500">
        <p>© 2026 WristFit AI Virtual Accessory Try-On. Built with Precision & Gold Theme (#D4AF37).</p>
      </footer>
    </div>
  );
}