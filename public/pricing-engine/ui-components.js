// ═══════════════════════════════════════════════
//  Barter Platform v3.0 — UI Components
//  Auth · Profile · Chat · Notifications · Ratings · Dark Mode · Disputes · Circular Match
// ═══════════════════════════════════════════════
'use strict';

const _L = (en, ar) => (typeof state !== 'undefined' && state.lang === 'en') ? en : ar;

const _fmtLocalPrice = (usdValue, categoryKey = 'other') => {
  if (typeof BarterEngine !== 'undefined' && typeof state !== 'undefined' && state.country) {
    const cp = BarterEngine.getCountryPrice(usdValue, state.country, categoryKey);
    if (typeof fmtLocal !== 'undefined') {
      return fmtLocal(cp.local, state.country);
    }
    const c = COUNTRIES[state.country] || COUNTRIES.EG;
    return c.symbol + cp.local.toLocaleString();
  }
  return '$' + usdValue;
};

// ─── 1. MODAL UTILITY ───
const Modal = {
  show(id, content, opts = {}) {
    let overlay = document.getElementById('modal-overlay-' + id);
    if (overlay) overlay.remove();
    overlay = document.createElement('div');
    overlay.id = 'modal-overlay-' + id;
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `<div class="modal-box ${opts.size || ''}" style="${opts.width ? 'max-width:'+opts.width : ''}">
      <div class="modal-head"><span class="modal-title">${opts.title || ''}</span><button class="modal-close" onclick="Modal.hide('${id}')">&times;</button></div>
      <div class="modal-body">${content}</div>
      ${opts.footer ? '<div class="modal-foot">' + opts.footer + '</div>' : ''}
    </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('active'));
    overlay.addEventListener('click', e => { if (e.target === overlay) Modal.hide(id); });
    document.addEventListener('keydown', function esc(e) { if (e.key === 'Escape') { Modal.hide(id); document.removeEventListener('keydown', esc); } });
  },
  hide(id) {
    const o = document.getElementById('modal-overlay-' + id);
    if (o) { o.classList.remove('active'); setTimeout(() => o.remove(), 300); }
  }
};

// ─── 2. TOAST NOTIFICATIONS ───
const Toast = {
  _container: null,
  _ensure() {
    if (!this._container) {
      this._container = document.createElement('div');
      this._container.className = 'toast-container';
      document.body.appendChild(this._container);
    }
  },
  show(message, type = 'info') {
    this._ensure();
    const icons = { success: '✅', info: 'ℹ️', warning: '⚠️', error: '❌' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span><span class="toast-msg">${message}</span>`;
    this._container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 4000);
  }
};

// ─── 3. DARK MODE SYSTEM ───
const DarkMode = {
  toggle() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('barter_dark_mode', isDark ? 'enabled' : 'disabled');
    this.updateToggleBtn();
  },
  init() {
    const saved = localStorage.getItem('barter_dark_mode');
    if (saved === 'enabled') {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
    this.updateToggleBtn();
  },
  updateToggleBtn() {
    const btn = document.getElementById('darkModeToggle');
    if (!btn) return;
    const isDark = document.body.classList.contains('dark-mode');
    btn.textContent = isDark ? '☀️' : '🌙';
    btn.title = isDark ? _L('Light Mode', 'الوضع المضيء') : _L('Dark Mode', 'الوضع المظلم');
  }
};

// ─── 4. AUTH MODAL ───
const AuthModal = {
  show(mode = 'login') {
    const isLogin = mode === 'login';
    // Build country options from COUNTRIES global
    let countryOpts = '';
    if (typeof COUNTRIES !== 'undefined') {
      Object.entries(COUNTRIES).forEach(([code, c]) => {
        countryOpts += `<option value="${code}" ${code === 'EG' ? 'selected' : ''}>${c.flag} ${c.nameEn}</option>`;
      });
    }
    
    const content = `
    <div class="auth-tabs">
      <button class="auth-tab ${isLogin ? 'active' : ''}" onclick="AuthModal.show('login')">${_L('Login','تسجيل دخول')}</button>
      <button class="auth-tab ${!isLogin ? 'active' : ''}" onclick="AuthModal.show('register')">${_L('Register','إنشاء حساب')}</button>
    </div>
    <form id="authForm" onsubmit="AuthModal.submit(event, '${mode}')" class="auth-form">
      ${!isLogin ? `<div class="form-group"><label>${_L('Full Name','الاسم الكامل')}</label><input type="text" id="authName" required placeholder="${_L('Your name','اسمك')}"></div>` : ''}
      <div class="form-group"><label>${_L('Email','البريد الإلكتروني')}</label><input type="email" id="authEmail" required placeholder="email@example.com"></div>
      <div class="form-group"><label>${_L('Password','كلمة المرور')}</label><input type="password" id="authPassword" required minlength="4" placeholder="${_L('Min 4 characters','4 أحرف على الأقل')}"></div>
      ${!isLogin ? `
        <div class="form-group"><label>${_L('Country','البلد')}</label><select id="authCountry">${countryOpts}</select></div>
        <div class="form-group"><label>${_L('Referral Code (optional)','كود إحالة (اختياري)')}</label><input type="text" id="authReferral" placeholder="ABC123"></div>
      ` : ''}
      <div id="authError" class="auth-error" style="display:none"></div>
      <button type="submit" class="btn-auth-submit">${isLogin ? _L('Login','دخول') : _L('Create Account','إنشاء حساب')}</button>
      ${isLogin ? `<p class="auth-hint">${_L('Demo: ahmed@demo.com / demo123','تجريبي: ahmed@demo.com / demo123')}</p>` : ''}
    </form>`;
    Modal.show('auth', content, { title: isLogin ? _L('Welcome Back','مرحباً بعودتك') : _L('Join Barter','انضم للمقايضة'), width: '420px' });
  },

  submit(e, mode) {
    e.preventDefault();
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    const errEl = document.getElementById('authError');
    
    if (mode === 'login') {
      const result = UserSystem.login(email, password);
      if (result.success) {
        Modal.hide('auth');
        HeaderUI.update();
        Toast.show(_L('Welcome back!','مرحباً بعودتك!'), 'success');
        if (typeof renderInventory === 'function') renderInventory();
      } else {
        errEl.textContent = result.error; errEl.style.display = 'block';
      }
    } else {
      const name = document.getElementById('authName').value;
      const country = document.getElementById('authCountry')?.value || 'EG';
      const referral = document.getElementById('authReferral')?.value || '';
      const result = UserSystem.register({ name, email, password, country });
      if (result.success) {
        if (referral) ReferralSystem.useCode(result.user.id, referral);
        Modal.hide('auth');
        HeaderUI.update();
        Toast.show(_L('Account created! +100 BarterCoins 🎉','تم إنشاء الحساب! +100 نقطة بارتر 🎉'), 'success');
        if (typeof renderInventory === 'function') renderInventory();
      } else {
        errEl.textContent = result.error; errEl.style.display = 'block';
      }
    }
  }
};

// ─── 5. HEADER UI ───
const HeaderUI = {
  update() {
    const container = document.getElementById('userHeaderArea');
    if (!container) return;
    const user = UserSystem.getCurrentUser();
    if (user) {
      const unread = NotificationData.getUnreadCount(user.id);
      const levelData = GamificationSystem.LEVELS[user.level] || GamificationSystem.LEVELS.beginner;
      container.innerHTML = `
        <div class="header-user">
          <button class="header-notif-btn" onclick="NotificationUI.toggle()" title="${_L('Notifications','إشعارات')}">
            🔔${unread > 0 ? `<span class="notif-badge">${unread}</span>` : ''}
          </button>
          <span class="header-coins" title="BarterCoins">🪙 ${user.barterCoins}</span>
          <button class="header-avatar-btn" onclick="ProfilePanel.show('${user.id}')" title="${_L('Profile','الملف الشخصي')}">
            <span class="header-avatar">${user.avatar}</span>
            <span class="header-name">${user.name.split(' ')[0]}</span>
            <span class="header-level">${levelData.icon}</span>
          </button>
          <button class="header-logout" onclick="HeaderUI.logout()" title="${_L('Logout','خروج')}">🚪</button>
        </div>`;
    } else {
      container.innerHTML = `
        <div class="header-auth-btns">
          <button class="btn-header-login" onclick="AuthModal.show('login')">${_L('Login','دخول')}</button>
          <button class="btn-header-register" onclick="AuthModal.show('register')">${_L('Register','حساب جديد')}</button>
        </div>`;
    }
    DarkMode.updateToggleBtn();
  },
  logout() {
    UserSystem.logout();
    this.update();
    Toast.show(_L('Logged out','تم تسجيل الخروج'), 'info');
    if (typeof renderInventory === 'function') renderInventory();
  }
};

// ─── 6. NOTIFICATION UI ───
const NotificationUI = {
  _open: false,
  toggle() {
    this._open = !this._open;
    let dropdown = document.getElementById('notifDropdown');
    if (this._open) {
      if (dropdown) dropdown.remove();
      const user = UserSystem.getCurrentUser();
      if (!user) return;
      const notifs = NotificationData.getForUser(user.id).slice(0, 15);
      dropdown = document.createElement('div');
      dropdown.id = 'notifDropdown';
      dropdown.className = 'notif-dropdown';
      
      let html = `<div class="notif-dd-header"><span>${_L('Notifications','الإشعارات')}</span><button onclick="NotificationUI.markAllRead()">${_L('Mark all read','قراءة الكل')}</button></div>`;
      if (notifs.length === 0) {
        html += `<div class="notif-empty">${_L('No notifications','لا توجد إشعارات')}</div>`;
      } else {
        notifs.forEach(n => {
          const time = this._timeAgo(n.timestamp);
          const typeIcons = { trade_request: '🤝', trade_accepted: '✅', trade_rejected: '❌', trade_completed: '🎉', new_message: '💬', new_rating: '⭐', coins_earned: '🪙', badge_earned: '🏅', referral_used: '🎁', trade_disputed: '⚠️', trade_dispute_resolved: '📢' };
          html += `<div class="notif-item ${n.read ? '' : 'unread'}" onclick="NotificationUI.clickNotif('${n.id}','${user.id}')">
            <span class="notif-type-icon">${typeIcons[n.type] || '📢'}</span>
            <div class="notif-text"><div class="notif-title">${state?.lang === 'en' ? (n.titleEn || n.titleAr) : (n.titleAr || n.titleEn)}</div>
            <div class="notif-msg">${state?.lang === 'en' ? (n.messageEn || n.messageAr) : (n.messageAr || n.messageEn)}</div>
            <div class="notif-time">${time}</div></div>
          </div>`;
        });
      }
      dropdown.innerHTML = html;
      document.querySelector('.header-notif-btn')?.appendChild(dropdown);
      setTimeout(() => document.addEventListener('click', this._closeHandler), 10);
    } else {
      if (dropdown) dropdown.remove();
      document.removeEventListener('click', this._closeHandler);
    }
  },
  _closeHandler(e) { if (!e.target.closest('.notif-dropdown') && !e.target.closest('.header-notif-btn')) { NotificationUI._open = false; const d = document.getElementById('notifDropdown'); if (d) d.remove(); document.removeEventListener('click', NotificationUI._closeHandler); } },
  clickNotif(notifId, userId) { NotificationData.markRead(userId, notifId); HeaderUI.update(); },
  markAllRead() { const u = UserSystem.getCurrentUser(); if (u) { NotificationData.markAllRead(u.id); HeaderUI.update(); Toast.show(_L('All read','تمت قراءة الكل'), 'info'); } },
  _timeAgo(ts) {
    const diff = (Date.now() - new Date(ts).getTime()) / 1000;
    if (diff < 60) return _L('Just now','الآن');
    if (diff < 3600) return `${Math.floor(diff/60)} ${_L('min ago','د')}`;
    if (diff < 86400) return `${Math.floor(diff/3600)} ${_L('hr ago','س')}`;
    return `${Math.floor(diff/86400)} ${_L('days ago','ي')}`;
  }
};

// ─── 7. CREATE LISTING MODAL ───
const CreateListingModal = {
  _imageData: null,
  show() {
    const user = UserSystem.getCurrentUser();
    if (!user) { AuthModal.show('login'); return; }
    
    let catOpts = '<option value="">' + _L('Select','اختر') + '</option>';
    if (typeof BARTER_CATEGORIES !== 'undefined') {
      Object.entries(BARTER_CATEGORIES).forEach(([k, v]) => {
        catOpts += `<option value="${k}">${v.icon} ${state?.lang === 'en' ? v.labelEn : v.labelAr}</option>`;
      });
    }
    
    const content = `
    <div class="listing-form">
      <div class="listing-img-upload" id="listingImgZone" onclick="document.getElementById('listingImgInput').click()">
        <input type="file" id="listingImgInput" accept="image/*" hidden onchange="CreateListingModal.handleImage(event)">
        <div id="listingImgPreview" class="listing-img-preview"><span class="dropzone-icon">📷</span><span>${_L('Add Photo','أضف صورة')}</span></div>
      </div>
      <div class="form-row"><div class="form-group"><label>${_L('Type','النوع')}</label><select id="listingType" onchange="CreateListingModal.toggleType()"><option value="good">${_L('Good','سلعة')}</option><option value="service">${_L('Service','خدمة')}</option></select></div>
      <div class="form-group"><label>${_L('Category','التصنيف')}</label><select id="listingCategory" onchange="CreateListingModal.updateSub()">${catOpts}</select></div></div>
      <div class="form-group"><label>${_L('Subcategory','الفرعي')}</label><select id="listingSub"></select></div>
      <div class="form-row"><div class="form-group"><label>${_L('Title (En)','العنوان (إنجليزي)')}</label><input type="text" id="listingTitle" placeholder="iPhone 15 Pro"></div>
      <div class="form-group"><label>${_L('Title (Ar)','العنوان (عربي)')}</label><input type="text" id="listingTitleAr" placeholder="آيفون 15 برو"></div></div>
      <div class="form-group"><label>${_L('Description','الوصف')}</label><textarea id="listingDesc" rows="2" placeholder="${_L('Describe your item...','وصف المنتج...')}"></textarea></div>
      <div id="listingGoodFields">
        <div class="form-row"><div class="form-group"><label>${_L('Price ($)','السعر ($)')}</label><input type="number" id="listingPrice" value="500"></div>
        <div class="form-group"><label>${_L('Age (years)','العمر')}</label><input type="number" id="listingAge" value="1" step="0.5"></div></div>
        <div class="form-row"><div class="form-group"><label>${_L('Condition','الحالة')}</label><select id="listingCondition"><option value="new">${_L('New','جديد')}</option><option value="like_new">${_L('Like New','كالجديد')}</option><option value="excellent" selected>${_L('Excellent','ممتاز')}</option><option value="good">${_L('Good','جيد')}</option><option value="fair">${_L('Fair','مقبول')}</option></select></div>
        <div class="form-group"><label>${_L('Demand','الطلب')}</label><select id="listingDemand"><option value="low">${_L('Low','منخفض')}</option><option value="normal" selected>${_L('Normal','عادي')}</option><option value="high">${_L('High','مرتفع')}</option></select></div></div>
      </div>
      <div id="listingServiceFields" style="display:none">
        <div class="form-row"><div class="form-group"><label>${_L('Hourly Rate ($)','سعر الساعة')}</label><input type="number" id="listingHourly" value="30"></div>
        <div class="form-group"><label>${_L('Hours','الساعات')}</label><input type="number" id="listingHours" value="10"></div></div>
        <div class="form-row"><div class="form-group"><label>${_L('Complexity','التعقيد')}</label><select id="listingComplexity"><option value="simple">${_L('Simple','بسيط')}</option><option value="medium" selected>${_L('Medium','متوسط')}</option><option value="complex">${_L('Complex','معقد')}</option></select></div>
        <div class="form-group"><label>${_L('Experience','الخبرة')}</label><select id="listingExperience"><option value="junior">${_L('Junior','مبتدئ')}</option><option value="mid" selected>${_L('Mid','متوسط')}</option><option value="expert">${_L('Expert','خبير')}</option></select></div></div>
      </div>
      <div class="form-group"><label>${_L('Desired Swap Category','التصنيف المرغوب')}</label><select id="listingDesired">${catOpts}</select></div>
      <button class="btn-listing-submit" onclick="CreateListingModal.submit()">${_L('📦 Publish Listing','📦 نشر العرض')}</button>
    </div>`;
    Modal.show('listing', content, { title: _L('New Listing','عرض جديد'), width: '520px' });
  },

  toggleType() {
    const isGood = document.getElementById('listingType').value === 'good';
    document.getElementById('listingGoodFields').style.display = isGood ? '' : 'none';
    document.getElementById('listingServiceFields').style.display = isGood ? 'none' : '';
  },

  updateSub() {
    const cat = document.getElementById('listingCategory').value;
    const subSel = document.getElementById('listingSub');
    subSel.innerHTML = '';
    if (cat && typeof BARTER_CATEGORIES !== 'undefined' && BARTER_CATEGORIES[cat]) {
      Object.entries(BARTER_CATEGORIES[cat].subcategories).forEach(([k, v]) => {
        subSel.innerHTML += `<option value="${k}">${state?.lang === 'en' ? v.labelEn : v.labelAr}</option>`;
      });
    }
  },

  handleImage(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      this._imageData = ev.target.result;
      document.getElementById('listingImgPreview').innerHTML = `<img src="${this._imageData}" style="width:100%;max-height:150px;object-fit:cover;border-radius:8px">`;
    };
    reader.readAsDataURL(file);
  },

  submit() {
    const type = document.getElementById('listingType').value;
    const data = {
      type,
      category: document.getElementById('listingCategory').value,
      subcategory: document.getElementById('listingSub').value,
      title: document.getElementById('listingTitle').value,
      titleAr: document.getElementById('listingTitleAr').value,
      description: document.getElementById('listingDesc')?.value || '',
      images: this._imageData ? [this._imageData] : [],
      desiredCategory: document.getElementById('listingDesired').value,
    };
    if (type === 'good') {
      data.basePrice = parseFloat(document.getElementById('listingPrice').value) || 500;
      data.ageYears = parseFloat(document.getElementById('listingAge').value) || 0;
      data.condition = document.getElementById('listingCondition').value;
      data.demand = document.getElementById('listingDemand').value;
    } else {
      data.hourlyRate = parseFloat(document.getElementById('listingHourly').value) || 25;
      data.hours = parseFloat(document.getElementById('listingHours').value) || 10;
      data.complexity = document.getElementById('listingComplexity').value;
      data.experience = document.getElementById('listingExperience').value;
    }
    if (!data.title && !data.titleAr) { Toast.show(_L('Please add a title','أضف عنواناً'), 'warning'); return; }
    if (!data.category) { Toast.show(_L('Select a category','اختر تصنيفاً'), 'warning'); return; }
    
    const result = ListingSystem.createListing(data);
    if (result.success) {
      Modal.hide('listing');
      this._imageData = null;
      Toast.show(_L('Listing published! 🎉','تم نشر العرض! 🎉'), 'success');
      HeaderUI.update();
      if (typeof renderInventory === 'function') renderInventory();
    } else {
      Toast.show(result.error, 'error');
    }
  }
};

// ─── 8. PROFILE PANEL (With Carbon Display) ───
const ProfilePanel = {
  show(userId) {
    const user = UserSystem.getUserById(userId);
    if (!user) { Toast.show(_L('User not found','المستخدم غير موجود'), 'error'); return; }
    const isOwn = UserSystem.getCurrentUser()?.id === userId;
    const country = typeof COUNTRIES !== 'undefined' ? COUNTRIES[user.country] : null;
    const levelData = GamificationSystem.LEVELS[user.level] || GamificationSystem.LEVELS.beginner;
    const listings = ListingSystem.getUserListings(userId);
    const ratings = RatingSystem.getUserRatings(userId);
    
    let badgesHtml = user.badges.map(b => {
      const bd = GamificationSystem.BADGES[b];
      return bd ? `<span class="badge-chip" title="${state?.lang==='en'?bd.labelEn:bd.labelAr}">${bd.icon}</span>` : '';
    }).join('');
    if (!badgesHtml) badgesHtml = `<span class="text-muted">${_L('No badges yet','لا شارات بعد')}</span>`;
    
    let ratingsHtml = ratings.slice(0, 5).map(r => `<div class="rating-item">
      <span>${'⭐'.repeat(r.score)}</span>
      <span class="rating-comment">${r.comment || ''}</span>
      <span class="rating-voter-info">(${r.raterName} · <small>${r.raterLevel}</small>)</span>
    </div>`).join('');
    
    let listingsHtml = listings.slice(0, 4).map(l => `<div class="mini-listing"><span>${typeof BARTER_CATEGORIES!=='undefined' ? BARTER_CATEGORIES[l.category]?.icon||'📦' : '📦'}</span><span>${state?.lang==='en' ? l.title : l.titleAr}</span><span class="text-muted">${_fmtLocalPrice(l.value, l.category)}</span></div>`).join('');
    
    const content = `
    <div class="profile-card">
      <div class="profile-header">
        <span class="profile-avatar">${user.avatar}</span>
        <div>
          <h3 class="profile-name">${user.name} ${levelData.icon}</h3>
          <p class="profile-country">${country?.flag||''} ${state?.lang==='en'?country?.nameEn||'':country?.nameAr||''} · ${_L('Member since','عضو منذ')} ${new Date(user.joinedAt).toLocaleDateString()}</p>
          <p class="profile-verify">${user.verificationLevel === 'full' ? '✅' : user.verificationLevel === 'phone' ? '📱' : '📧'} ${_L('Verified: ','موثق: ')}${user.verificationLevel}</p>
        </div>
      </div>
      <div class="profile-stats-grid">
        <div class="pstat"><span class="pstat-val">${user.stats.successfulTrades}</span><span class="pstat-lbl">${_L('Trades','مقايضات')}</span></div>
        <div class="pstat"><span class="pstat-val">⭐ ${user.rating.avg || 0}</span><span class="pstat-lbl">${user.rating.count} ${_L('reviews','تقييم')}</span></div>
        <div class="pstat"><span class="pstat-val">🪙 ${user.barterCoins}</span><span class="pstat-lbl">Coins</span></div>
        <div class="pstat"><span class="pstat-val">🌱 ${user.stats.carbonSaved || 0}kg</span><span class="pstat-lbl">${_L('CO2 Saved','كربون موفر')}</span></div>
      </div>
      <div class="profile-section"><h4>${_L('Badges','الشارات')}</h4><div class="badges-row">${badgesHtml}</div></div>
      <div class="profile-section"><h4>${_L('Active Listings','العروض النشطة')} (${listings.length})</h4>${listingsHtml || '<p class="text-muted">'+_L('No active listings','لا عروض نشطة')+'</p>'}</div>
      <div class="profile-section"><h4>${_L('Recent Ratings','آخر التقييمات')}</h4>${ratingsHtml || '<p class="text-muted">'+_L('No ratings yet','لا تقييمات بعد')+'</p>'}</div>
      ${isOwn ? `<div class="profile-section"><h4>${_L('Referral Code','كود الإحالة')}</h4><div class="referral-box"><code class="referral-code">${user.referralCode}</code><button onclick="navigator.clipboard.writeText('${user.referralCode}');Toast.show('${_L('Copied!','تم النسخ!')}','success')" class="btn-copy">${_L('Copy','نسخ')}</button></div><p class="text-muted">${_L('Share to earn 25 BC per referral','شارك واحصل 25 نقطة لكل إحالة')}</p></div>` : ''}
    </div>`;
    Modal.show('profile', content, { title: _L('Profile','الملف الشخصي'), width: '500px' });
  }
};

// ─── 9. TRADE MODAL (With Disputes Support) ───
const TradeModal = {
  showRequest(targetListingId) {
    const user = UserSystem.getCurrentUser();
    if (!user) { AuthModal.show('login'); return; }
    const target = ListingSystem.getListingById(targetListingId);
    if (!target) { Toast.show(_L('Listing not found','العرض غير موجود'), 'error'); return; }
    
    const myListings = ListingSystem.getUserListings(user.id);
    let opts = myListings.map(l => `<option value="${l.id}">${state?.lang==='en'?l.title:l.titleAr} (${_fmtLocalPrice(l.value, l.category)})</option>`).join('');
    if (!opts) opts = `<option value="" disabled>${_L('No listings - create one first','لا عروض - أنشئ واحداً أولاً')}</option>`;
    
    const content = `
    <div class="trade-request">
      <div class="trade-target"><h4>${_L('You want','تريد')}</h4><div class="trade-item-card">${target.images?.[0] ? `<img src="${target.images[0]}" class="trade-item-img">` : `<span class="trade-item-icon">${typeof BARTER_CATEGORIES!=='undefined'?BARTER_CATEGORIES[target.category]?.icon||'📦':'📦'}</span>`}<div><strong>${state?.lang==='en'?target.title:target.titleAr}</strong><p>${_fmtLocalPrice(target.value, target.category)}</p></div></div></div>
      <div class="trade-offer"><h4>${_L('Your offer','عرضك')}</h4><select id="tradeOfferSelect" class="trade-select">${opts}</select></div>
      <div class="form-group"><label>${_L('Message','رسالة')}</label><textarea id="tradeMessage" rows="2" placeholder="${_L('Write a message...','اكتب رسالة...')}"></textarea></div>
      <div class="form-group"><label>${_L('Add BarterCoins','إضافة نقاط بارتر')}</label><input type="number" id="tradeCoinOffer" value="0" min="0" max="${user.barterCoins}"><span class="text-muted">${_L('Balance: ','الرصيد: ')}${user.barterCoins} BC</span></div>
      <button class="btn-trade-submit" onclick="TradeModal.submitRequest('${targetListingId}')">${_L('🤝 Send Trade Request','🤝 إرسال طلب مقايضة')}</button>
    </div>`;
    Modal.show('trade', content, { title: _L('Trade Request','طلب مقايضة'), width: '480px' });
  },

  submitRequest(targetId) {
    const myListingId = document.getElementById('tradeOfferSelect')?.value;
    const message = document.getElementById('tradeMessage')?.value || '';
    const coinOffer = parseInt(document.getElementById('tradeCoinOffer')?.value) || 0;
    if (!myListingId) { Toast.show(_L('Select a listing to offer','اختر عرضاً'), 'warning'); return; }
    const result = TradeSystem.requestTrade({ listingIdA: myListingId, listingIdB: targetId, message, coinOffer });
    if (result.success) {
      Modal.hide('trade');
      Toast.show(_L('Trade request sent! 🤝','تم إرسال طلب المقايضة! 🤝'), 'success');
    } else { Toast.show(result.error, 'error'); }
  },

  showTrade(tradeId) {
    const trade = TradeSystem.getTradeById(tradeId);
    if (!trade) return;
    const user = UserSystem.getCurrentUser();
    const isA = user?.id === trade.partyA;
    const otherUser = UserSystem.getUserById(isA ? trade.partyB : trade.partyA);
    const statusColors = { pending: 'var(--amber)', in_escrow: 'var(--cyan)', completed: 'var(--emerald)', cancelled: 'var(--rose)', disputed: 'var(--rose)' };
    const statusLabels = { pending: _L('Pending','قيد الانتظار'), in_escrow: _L('In Escrow','في الضمان'), completed: _L('Completed','مكتمل'), cancelled: _L('Cancelled','ملغي'), disputed: _L('⚠️ Disputed','⚠️ قيد النزاع') };
    
    let actionsHtml = '';
    let disputeHtml = '';

    if (trade.status === 'pending' && !isA) {
      actionsHtml = `<button class="btn-accept" onclick="TradeModal.accept('${tradeId}')">${_L('✅ Accept','✅ قبول')}</button>
                     <button class="btn-reject" onclick="TradeModal.reject('${tradeId}')">${_L('❌ Decline','❌ رفض')}</button>`;
    }
    
    if (trade.status === 'in_escrow') {
      const myConfirmed = isA ? trade.escrow.partyAConfirmed : trade.escrow.partyBConfirmed;
      if (!myConfirmed) {
        actionsHtml = `<button class="btn-confirm" onclick="TradeModal.confirmDelivery('${tradeId}','${isA?'A':'B'}')">${_L('📦 Confirm Delivery','📦 تأكيد التسليم')}</button>
                       <button class="btn-dispute-trigger" onclick="TradeModal.triggerDispute('${tradeId}')">${_L('⚠️ Open Dispute','⚠️ فتح نزاع')}</button>`;
      } else {
        actionsHtml = `<div style="display:flex;flex-direction:column;gap:8px;align-items:center;">
          <span class="text-muted">${_L('Waiting for other party...','بانتظار الطرف الآخر...')}</span>
          <button class="btn-dispute-trigger-secondary" onclick="TradeModal.triggerDispute('${tradeId}')">${_L('⚠️ Open Dispute','⚠️ فتح نزاع')}</button>
        </div>`;
      }
    }

    if (trade.status === 'disputed') {
      disputeHtml = `
      <div class="dispute-box">
        <div class="dispute-title">⚠️ ${_L('Dispute active','النزاع نشط')}</div>
        <div class="dispute-reason"><strong>${_L('Reason: ','السبب: ')}</strong>${trade.dispute?.reason || ''}</div>
        <div class="dispute-mediator-panel">
          <label>👮 ${_L('Mediator Control (Demo)','وسيط المنصة (تجريبي)')}</label>
          <div class="mediator-buttons">
            <button class="btn-confirm" onclick="TradeModal.resolveDispute('${tradeId}','release')">${_L('🟢 Force Complete','🟢 إتمام وتحرير')}</button>
            <button class="btn-reject" onclick="TradeModal.resolveDispute('${tradeId}','refund')">${_L('🔴 Cancel & Refund','🔴 إلغاء وإرجاع')}</button>
          </div>
        </div>
      </div>`;
    }

    if (trade.status === 'completed') {
      const myRating = isA ? trade.rating.byA : trade.rating.byB;
      if (!myRating) actionsHtml = `<button class="btn-rate" onclick="RatingModal.show('${tradeId}')">${_L('⭐ Rate Trade','⭐ قيّم المقايضة')}</button>`;
      else actionsHtml = `<span class="text-muted">${_L('Rated','تم التقييم')} ${'⭐'.repeat(myRating.score)}</span>`;
    }
    
    const content = `
    <div class="trade-view">
      <div class="trade-status" style="color:${statusColors[trade.status]}">${statusLabels[trade.status]}</div>
      <div class="trade-parties">
        <div class="trade-party"><span class="trade-party-avatar">${UserSystem.getUserById(trade.partyA)?.avatar||'👤'}</span><span>${UserSystem.getUserById(trade.partyA)?.name||'?'}</span></div>
        <span class="trade-vs">⇄</span>
        <div class="trade-party"><span class="trade-party-avatar">${otherUser?.avatar||'👤'}</span><span>${otherUser?.name||'?'}</span></div>
      </div>
      <div class="trade-items">
        <div class="trade-item-mini"><strong>${state?.lang==='en'?trade.listingA.title:trade.listingA.titleAr}</strong><span>${_fmtLocalPrice(trade.listingA.value, trade.listingA.category)}</span></div>
        <span class="trade-arrow">↔</span>
        <div class="trade-item-mini"><strong>${state?.lang==='en'?trade.listingB.title:trade.listingB.titleAr}</strong><span>${_fmtLocalPrice(trade.listingB.value, trade.listingB.category)}</span></div>
      </div>
      ${trade.coinOffer ? `<div class="trade-coins">${_L('+ BarterCoins: ','+ نقاط: ')}${trade.coinOffer} BC</div>` : ''}
      ${disputeHtml}
      <div class="trade-actions">${actionsHtml}</div>
      <button class="btn-chat-open" onclick="ChatWidget.show('${tradeId}')">${_L('💬 Open Chat','💬 فتح المحادثة')}</button>
    </div>`;
    Modal.show('tradeview', content, { title: _L('Trade Details','تفاصيل المقايضة'), width: '480px' });
  },

  accept(tradeId) { TradeSystem.acceptTrade(tradeId); Modal.hide('tradeview'); Toast.show(_L('Trade accepted!','تم قبول المقايضة!'), 'success'); HeaderUI.update(); },
  reject(tradeId) { TradeSystem.rejectTrade(tradeId); Modal.hide('tradeview'); Toast.show(_L('Trade declined','تم رفض المقايضة'), 'info'); HeaderUI.update(); },
  confirmDelivery(tradeId, party) { TradeSystem.confirmDelivery(tradeId, party); this.showTrade(tradeId); Toast.show(_L('Delivery confirmed!','تم تأكيد التسليم!'), 'success'); HeaderUI.update(); },
  
  triggerDispute(tradeId) {
    const reason = prompt(_L('Please state the reason for opening a dispute:', 'الرجاء كتابة سبب فتح النزاع:'));
    if (!reason || !reason.trim()) return;
    const user = UserSystem.getCurrentUser();
    if (!user) return;
    const success = TradeSystem.openDispute(tradeId, user.id, reason.trim());
    if (success) {
      this.showTrade(tradeId);
      Toast.show(_L('Dispute opened successfully. Platform mediator notified.','تم فتح النزاع بنجاح. تم إشعار وسيط المنصة.'), 'warning');
    }
  },

  resolveDispute(tradeId, resolution) {
    const success = TradeSystem.resolveDispute(tradeId, resolution);
    if (success) {
      this.showTrade(tradeId);
      Toast.show(_L('Dispute resolved by mediator.','تم حل النزاع بواسطة الوسيط.'), 'success');
      HeaderUI.update();
    }
  }
};

// ─── 10. CHAT WIDGET ───
const ChatWidget = {
  _tradeId: null,
  show(tradeId) {
    this._tradeId = tradeId;
    const trade = TradeSystem.getTradeById(tradeId);
    if (!trade) return;
    const user = UserSystem.getCurrentUser();
    const isA = user?.id === trade.partyA;
    const other = UserSystem.getUserById(isA ? trade.partyB : trade.partyA);
    
    let existing = document.getElementById('chatWidget');
    if (existing) existing.remove();
    
    const widget = document.createElement('div');
    widget.id = 'chatWidget';
    widget.className = 'chat-widget';
    widget.innerHTML = `
      <div class="chat-header"><span>${other?.avatar||'👤'} ${other?.name||'?'}</span><button onclick="ChatWidget.hide()">&times;</button></div>
      <div class="chat-messages" id="chatMessages"></div>
      <div class="chat-input-area"><input type="text" id="chatInput" placeholder="${_L('Type a message...','اكتب رسالة...')}" onkeypress="if(event.key==='Enter')ChatWidget.send()"><button onclick="ChatWidget.send()">${_L('Send','إرسال')}</button></div>`;
    document.body.appendChild(widget);
    this._renderMessages();
  },
  hide() { const w = document.getElementById('chatWidget'); if (w) w.remove(); this._tradeId = null; },
  send() {
    const input = document.getElementById('chatInput');
    if (!input || !input.value.trim()) return;
    const user = UserSystem.getCurrentUser();
    if (!user || !this._tradeId) return;
    TradeSystem.addTradeMessage(this._tradeId, user.id, input.value.trim());
    input.value = '';
    this._renderMessages();
  },
  _renderMessages() {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    const trade = TradeSystem.getTradeById(this._tradeId);
    const user = UserSystem.getCurrentUser();
    if (!trade || !user) return;
    container.innerHTML = trade.messages.map(m => {
      const isOwn = m.senderId === user.id;
      const sender = UserSystem.getUserById(m.senderId);
      const time = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `<div class="chat-msg ${isOwn ? 'own' : 'other'}"><div class="chat-bubble"><span class="chat-sender">${isOwn ? '' : (sender?.avatar||'') + ' '}</span>${m.text}<span class="chat-time">${time}</span></div></div>`;
    }).join('');
    container.scrollTop = container.scrollHeight;
  }
};

// ─── 11. RATING MODAL ───
const RatingModal = {
  _score: 0,
  show(tradeId) {
    this._score = 0;
    const content = `
    <div class="rating-form">
      <p>${_L('Rate your trading experience','قيّم تجربة المقايضة')}</p>
      <div class="star-rating" id="starRating">${[1,2,3,4,5].map(i => `<span class="star" data-val="${i}" onclick="RatingModal.setScore(${i})">☆</span>`).join('')}</div>
      <textarea id="ratingComment" rows="2" placeholder="${_L('Optional comment...','تعليق اختياري...')}"></textarea>
      <button class="btn-rate-submit" onclick="RatingModal.submit('${tradeId}')">${_L('Submit Rating','إرسال التقييم')}</button>
    </div>`;
    Modal.show('rating', content, { title: _L('Rate Trade','تقييم المقايضة'), width: '380px' });
  },
  setScore(val) {
    this._score = val;
    document.querySelectorAll('#starRating .star').forEach(s => {
      s.textContent = parseInt(s.dataset.val) <= val ? '★' : '☆';
      s.classList.toggle('active', parseInt(s.dataset.val) <= val);
    });
  },
  submit(tradeId) {
    if (this._score < 1) { Toast.show(_L('Select a rating','اختر تقييماً'), 'warning'); return; }
    const comment = document.getElementById('ratingComment')?.value || '';
    const user = UserSystem.getCurrentUser();
    if (!user) return;
    RatingSystem.rateTrade(tradeId, user.id, this._score, comment);
    Modal.hide('rating');
    Toast.show(_L('Thanks for rating! ⭐','شكراً على التقييم! ⭐'), 'success');
    HeaderUI.update();
  }
};

// ─── 12. DASHBOARD (With Carbon Savings & Circular Match) ───
const DashboardPanel = {
  show() {
    const user = UserSystem.getCurrentUser();
    if (!user) { AuthModal.show('login'); return; }
    const trades = TradeSystem.getTradesForUser(user.id);
    const listings = ListingSystem.getUserListings(user.id);
    const levelData = GamificationSystem.LEVELS[user.level];
    const nextLevel = Object.values(GamificationSystem.LEVELS).find(l => l.minTrades > user.stats.successfulTrades);
    const progress = nextLevel ? Math.min(100, Math.round((user.stats.successfulTrades / nextLevel.minTrades) * 100)) : 100;
    
    let tradesHtml = trades.slice(0, 5).map(t => {
      const statusIcon = { pending: '⏳', in_escrow: '🔒', completed: '✅', cancelled: '❌', disputed: '⚠️' };
      return `<div class="dash-trade" onclick="TradeModal.showTrade('${t.id}')">${statusIcon[t.status]||'📦'} ${state?.lang==='en'?t.listingA.title:t.listingA.titleAr} ↔ ${state?.lang==='en'?t.listingB.title:t.listingB.titleAr}</div>`;
    }).join('') || `<p class="text-muted">${_L('No trades yet','لا مقايضات بعد')}</p>`;
    
    // Circular matches calculations
    let circularHtml = '';
    if (typeof CircularMatchingSystem !== 'undefined') {
      const cycles = CircularMatchingSystem.findCycles();
      // Filter cycles involving this user
      const myCycles = cycles.filter(c => c.u1.id === user.id || c.u2.id === user.id || c.u3.id === user.id);
      
      if (myCycles.length > 0) {
        circularHtml = `<div class="dash-section circular-matches-section">
          <h4>🌱 ${_L('Circular Swap Matches (3-Way)','المقايضات الدائرية المقترحة (ثلاثية)')}</h4>`;
        myCycles.forEach(c => {
          circularHtml += `
          <div class="circular-match-card">
            <div class="cycle-path">
              <span class="cycle-node">🧔 ${c.u1.name.split(' ')[0]} (${state?.lang==='en'?c.l1.title:c.l1.titleAr})</span>
              <span class="cycle-arrow">➔</span>
              <span class="cycle-node">🧕 ${c.u2.name.split(' ')[0]} (${state?.lang==='en'?c.l2.title:c.l2.titleAr})</span>
              <span class="cycle-arrow">➔</span>
              <span class="cycle-node">👨 ${c.u3.name.split(' ')[0]} (${state?.lang==='en'?c.l3.title:c.l3.titleAr})</span>
              <span class="cycle-arrow">➔</span>
              <span class="cycle-node-loop">🔄</span>
            </div>
            <button class="btn-circular-chat" onclick="Toast.show('${_L('Circular chat room setup coming soon! Use direct chat for negotiation.','المحادثة الدائرية المشتركة قريباً! استخدم المحادثات الثنائية حالياً.')}','info')">
              💬 ${_L('Initiate Multi-Party Deal','بدء تفاوض ثلاثي')}
            </button>
          </div>`;
        });
        circularHtml += `</div>`;
      }
    }

    const content = `
    <div class="dashboard">
      <div class="dash-welcome"><span>${user.avatar}</span><div><h3>${_L('Welcome','مرحباً')} ${user.name}!</h3><p>${levelData?.icon} ${state?.lang==='en'?levelData?.labelEn:levelData?.labelAr}</p></div></div>
      <div class="dash-progress"><div class="progress-bar"><div class="progress-fill" style="width:${progress}%"></div></div><span class="text-muted">${progress}% → ${nextLevel ? (state?.lang==='en'?nextLevel.labelEn:nextLevel.labelAr) : _L('Max Level','أعلى مستوى')}</span></div>
      <div class="dash-stats">
        <div class="dstat"><span class="dstat-icon">🤝</span><span class="dstat-val">${user.stats.successfulTrades}</span><span class="dstat-lbl">${_L('Trades','مقايضات')}</span></div>
        <div class="dstat"><span class="dstat-icon">📦</span><span class="dstat-val">${listings.length}</span><span class="dstat-lbl">${_L('Listings','عروض')}</span></div>
        <div class="dstat"><span class="dstat-icon">🌱</span><span class="dstat-val">${user.stats.carbonSaved || 0}kg</span><span class="dstat-lbl">${_L('CO2 Saved','كربون موفر')}</span></div>
        <div class="dstat"><span class="dstat-icon">⭐</span><span class="dstat-val">${user.rating.avg||0}</span><span class="dstat-lbl">${_L('Rating','تقييم')}</span></div>
      </div>
      ${circularHtml}
      <div class="dash-section"><h4>${_L('Recent Trades','آخر المقايضات')}</h4>${tradesHtml}</div>
    </div>`;
    Modal.show('dashboard', content, { title: _L('Dashboard','لوحة التحكم'), width: '520px' });
  }
};

// ─── 13. TRADES LIST ───
const TradesPanel = {
  show() {
    const user = UserSystem.getCurrentUser();
    if (!user) { AuthModal.show('login'); return; }
    const trades = TradeSystem.getTradesForUser(user.id);
    const statusIcon = { pending: '⏳', in_escrow: '🔒', completed: '✅', cancelled: '❌', disputed: '⚠️' };
    const statusLabel = { pending: _L('Pending','قيد الانتظار'), in_escrow: _L('In Escrow','في الضمان'), completed: _L('Completed','مكتمل'), cancelled: _L('Cancelled','ملغي'), disputed: _L('⚠️ Disputed','⚠️ قيد النزاع') };
    
    let html = trades.map(t => {
      const other = UserSystem.getUserById(t.partyA === user.id ? t.partyB : t.partyA);
      return `<div class="trades-item" onclick="TradeModal.showTrade('${t.id}')">
        <span class="trades-status">${statusIcon[t.status]}</span>
        <div class="trades-info"><strong>${state?.lang==='en'?t.listingA.title:t.listingA.titleAr} ↔ ${state?.lang==='en'?t.listingB.title:t.listingB.titleAr}</strong>
        <span class="text-muted">${_L('with','مع')} ${other?.name||'?'} · ${statusLabel[t.status]}</span></div>
      </div>`;
    }).join('') || `<p class="text-muted" style="text-align:center;padding:20px">${_L('No trades yet. Start by browsing listings!','لا مقايضات بعد. ابدأ بتصفح العروض!')}</p>`;
    
    Modal.show('trades', html, { title: _L('My Trades','مقايضاتي'), width: '520px' });
  }
};

// ─── REAL-TIME SYNC & EVENTS ───
window.addEventListener('platform-db-synced', () => {
  HeaderUI.update();
  if (document.getElementById('modal-overlay-trades')) TradesPanel.show();
  if (document.getElementById('modal-overlay-dashboard')) DashboardPanel.show();
});

// Initialize Dark Mode settings
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    DarkMode.init();
  }, 100);
});

// ─── GLOBAL EXPORTS ───
window.Modal = Modal;
window.Toast = Toast;
window.DarkMode = DarkMode;
window.AuthModal = AuthModal;
window.HeaderUI = HeaderUI;
window.NotificationUI = NotificationUI;
window.CreateListingModal = CreateListingModal;
window.ProfilePanel = ProfilePanel;
window.TradeModal = TradeModal;
window.ChatWidget = ChatWidget;
window.RatingModal = RatingModal;
window.DashboardPanel = DashboardPanel;
window.TradesPanel = TradesPanel;
