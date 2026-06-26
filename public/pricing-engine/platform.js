// ═══════════════════════════════════════════════
//  Barter Platform v3.0 — Core Logic (Secured & Optimized)
//  API Synchronization · Circular Matching · Weighted Reputation · Carbon Savings
// ═══════════════════════════════════════════════
'use strict';

// ─── 1. STORAGE LAYER (With Server API Sync) ───
const PlatformDB = {
  _get(key) {
    try {
      const val = localStorage.getItem('barter_' + key);
      return val ? JSON.parse(val) : null;
    } catch {
      return null;
    }
  },
  
  _set(key, val) {
    try {
      localStorage.setItem('barter_' + key, JSON.stringify(val));
    } catch (e) {}
    this.saveToServer();
  },
  
  _remove(key) {
    try {
      localStorage.removeItem('barter_' + key);
    } catch (e) {}
    this.saveToServer();
  },
  
  _keys(prefix) {
    const results = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('barter_' + prefix)) {
        results.push(k.replace('barter_', ''));
      }
    }
    return results;
  },

  async loadFromServer() {
    try {
      const res = await fetch('/api/data');
      const data = await res.json();
      if (data && !data.error) {
        // Clear current barter_ keys in localStorage to prevent mismatch
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (k && k.startsWith('barter_')) {
            localStorage.removeItem(k);
          }
        }
        // Write new keys from server to localStorage
        for (const [k, v] of Object.entries(data)) {
          localStorage.setItem(k, JSON.stringify(v));
        }
        console.log('✅ Synchronized successfully with server database.');
      }
    } catch (e) {
      console.warn('⚠️ Server database unreachable. Running in standalone LocalStorage mode.');
    }
    // Dispatch event to notify UI components to reload data
    window.dispatchEvent(new CustomEvent('platform-db-synced'));
  },

  async saveToServer() {
    try {
      const data = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('barter_')) {
          try {
            data[k] = JSON.parse(localStorage.getItem(k));
          } catch {}
        }
      }
      await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } catch (e) {
      console.warn('⚠️ Could not save database to server:', e);
    }
  }
};

// ─── 2. CARBON SAVINGS CALCULATOR ───
const CarbonCalculator = {
  CATEGORIES: {
    electronics: 80,
    fashion: 15,
    home_garden: 45,
    vehicles: 250,
    sports_outdoors: 30,
    books: 5,
    toys_hobbies: 12,
    arts_crafts: 10,
    industrial: 110,
    digital: 2,
    education: 1,
    services: 1,
    real_estate: 800,
    other: 10
  },
  getSavings(category) {
    return this.CATEGORIES[category] || 10;
  }
};

// ─── 3. USER SYSTEM ───
const UserSystem = {
  _sessionKey: 'current_session',

  _hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h |= 0; }
    return 'h' + Math.abs(h).toString(36);
  },

  register({ name, email, password, country, avatar }) {
    if (!name || !email || !password) return { success: false, error: 'Missing required fields' };
    email = email.toLowerCase().trim();
    if (PlatformDB._get('email_' + email)) return { success: false, error: 'Email already registered' };

    const id = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
    const referralCode = Math.random().toString(36).substr(2, 6).toUpperCase();

    const user = {
      id, name, email, passwordHash: this._hash(password),
      country: country || 'EG',
      avatar: avatar || ['😊','😎','🧑‍💼','👨‍🔧','👩‍🏫','🧕','🧑‍💻'][Math.floor(Math.random()*7)],
      barterCoins: 100,
      level: 'beginner',
      badges: [],
      rating: { sum: 0, count: 0, avg: 0 },
      stats: { totalTrades: 0, successfulTrades: 0, acceptRate: 0, responseTimeAvg: 0, streak: 0, listingCount: 0, carbonSaved: 0 },
      referralCode,
      referrals: [],
      referredBy: null,
      verificationLevel: 'email',
      joinedAt: new Date().toISOString(),
      lastActive: new Date().toISOString()
    };

    PlatformDB._set('user_' + id, user);
    PlatformDB._set('email_' + email, id);
    PlatformDB._set('refcode_' + referralCode, id);
    this._setSession(id);

    // Signup bonus notification
    NotificationData.add(id, {
      type: 'coins_earned',
      titleEn: 'Welcome Bonus!', titleAr: 'مكافأة ترحيبية!',
      messageEn: 'You earned 100 BarterCoins as a welcome gift!',
      messageAr: 'حصلت على 100 نقطة بارتر كهدية ترحيبية!',
      data: { amount: 100 }
    });

    CoinSystem._log(id, 'credit', 100, 'signup_bonus', user.barterCoins);
    return { success: true, user };
  },

  login(email, password) {
    email = email.toLowerCase().trim();
    const userId = PlatformDB._get('email_' + email);
    if (!userId) return { success: false, error: 'Email not found' };

    const user = PlatformDB._get('user_' + userId);
    if (!user) return { success: false, error: 'User data corrupted' };
    if (user.passwordHash !== this._hash(password)) return { success: false, error: 'Wrong password' };

    user.lastActive = new Date().toISOString();
    PlatformDB._set('user_' + userId, user);
    this._setSession(userId);
    return { success: true, user };
  },

  logout() { PlatformDB._remove(this._sessionKey); },

  getCurrentUser() {
    const id = PlatformDB._get(this._sessionKey);
    if (!id) return null;
    return PlatformDB._get('user_' + id);
  },

  getUserById(id) { return PlatformDB._get('user_' + id); },

  updateProfile(userId, updates) {
    const user = this.getUserById(userId);
    if (!user) return null;
    Object.assign(user, updates, { lastActive: new Date().toISOString() });
    PlatformDB._set('user_' + userId, user);
    return user;
  },

  getAllUsers() {
    const keys = PlatformDB._keys('user_user_');
    return keys.map(k => PlatformDB._get(k)).filter(Boolean);
  },

  _setSession(userId) { PlatformDB._set(this._sessionKey, userId); },

  isLoggedIn() { return !!PlatformDB._get(this._sessionKey); }
};

// ─── 4. LISTING SYSTEM ───
const ListingSystem = {
  createListing(data) {
    const user = UserSystem.getCurrentUser();
    if (!user) return { success: false, error: 'Not logged in' };

    const id = 'listing_' + Date.now() + '_' + Math.random().toString(36).substr(2,4);

    // Calculate value
    let value = 0;
    if (data.type === 'good' && typeof BarterEngine !== 'undefined') {
      const res = BarterEngine.valueGood({ basePrice: data.basePrice || 0, ageYears: data.ageYears || 0, conditionKey: data.condition || 'good', demandKey: data.demand || 'normal', category: data.category || 'electronics', subcategory: data.subcategory || 'smartphones' });
      value = res.finalValue || 0;
    } else if (data.type === 'service' && typeof BarterEngine !== 'undefined') {
      const res = BarterEngine.valueService({ hourlyRate: data.hourlyRate || 0, hours: data.hours || 0, complexityKey: data.complexity || 'medium', experienceKey: data.experience || 'mid' });
      value = res.finalValue || 0;
    }

    const listing = {
      id,
      ownerId: user.id,
      ownerName: user.name,
      ownerAvatar: user.avatar,
      ownerCountry: user.country,
      type: data.type || 'good',
      category: data.category || 'electronics',
      subcategory: data.subcategory || 'smartphones',
      title: data.title || '',
      titleAr: data.titleAr || data.title || '',
      description: data.description || '',
      images: data.images || [],  // base64 array
      basePrice: data.basePrice || 0,
      ageYears: data.ageYears || 0,
      conditionKey: data.condition || 'good',
      demandKey: data.demand || 'normal',
      hourlyRate: data.hourlyRate || 0,
      hours: data.hours || 0,
      complexityKey: data.complexity || 'medium',
      experienceKey: data.experience || 'mid',
      desiredCategory: data.desiredCategory || '',
      countryCode: user.country,
      value,
      status: 'active',
      views: 0,
      createdAt: new Date().toISOString()
    };

    PlatformDB._set(id, listing);

    // Update user stats
    user.stats.listingCount = (user.stats.listingCount || 0) + 1;
    UserSystem.updateProfile(user.id, { stats: user.stats });

    return { success: true, listing };
  },

  getListings(filters) {
    if (!filters) filters = {};
    const keys = PlatformDB._keys('listing_');
    let listings = keys.map(function(k) { return PlatformDB._get(k); }).filter(function(l) { return l && l.status === 'active'; });

    if (filters.category) listings = listings.filter(function(l) { return l.category === filters.category; });
    if (filters.country) listings = listings.filter(function(l) { return l.countryCode === filters.country; });
    if (filters.type) listings = listings.filter(function(l) { return l.type === filters.type; });
    if (filters.ownerId) listings = listings.filter(function(l) { return l.ownerId === filters.ownerId; });
    if (filters.minPrice) listings = listings.filter(function(l) { return l.value >= filters.minPrice; });
    if (filters.maxPrice) listings = listings.filter(function(l) { return l.value <= filters.maxPrice; });
    if (filters.search) {
      var q = filters.search.toLowerCase();
      listings = listings.filter(function(l) { return l.title.toLowerCase().includes(q) || l.titleAr.includes(q); });
    }

    return listings.sort(function(a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
  },

  getListingById(id) { return PlatformDB._get(id); },

  getUserListings(userId) { return this.getListings({ ownerId: userId }); },

  deleteListing(id) {
    const listing = this.getListingById(id);
    if (listing) { listing.status = 'deleted'; PlatformDB._set(id, listing); }
  },

  incrementViews(id) {
    const listing = this.getListingById(id);
    if (listing) { listing.views++; PlatformDB._set(id, listing); }
  }
};

// ─── 5. TRADE SYSTEM (With Disputes & Carbon Savings) ───
const TradeSystem = {
  requestTrade({ listingIdA, listingIdB, message, coinOffer }) {
    const user = UserSystem.getCurrentUser();
    if (!user) return { success: false, error: 'Not logged in' };

    const listingA = ListingSystem.getListingById(listingIdA);
    const listingB = ListingSystem.getListingById(listingIdB);
    if (!listingA || !listingB) return { success: false, error: 'Listing not found' };

    const id = 'trade_' + Date.now();
    const trade = {
      id,
      partyA: user.id,
      partyB: listingB.ownerId,
      listingA: {
        id: listingIdA,
        title: listingA.title,
        titleAr: listingA.titleAr,
        value: listingA.value,
        category: listingA.category,
        image: (listingA.images && listingA.images[0]) ? listingA.images[0] : ''
      },
      listingB: {
        id: listingIdB,
        title: listingB.title,
        titleAr: listingB.titleAr,
        value: listingB.value,
        category: listingB.category,
        image: (listingB.images && listingB.images[0]) ? listingB.images[0] : ''
      },
      status: 'pending',
      coinOffer: coinOffer || 0,
      cashOffset: Math.abs(listingA.value - listingB.value),
      messages: message ? [{
        id: 'm_' + Date.now(),
        senderId: user.id,
        text: message,
        timestamp: new Date().toISOString(),
        read: false
      }] : [],
      escrow: { active: false, partyAConfirmed: false, partyBConfirmed: false },
      rating: { byA: null, byB: null },
      dispute: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    PlatformDB._set(id, trade);

    // Notify party B
    NotificationData.add(trade.partyB, {
      type: 'trade_request',
      titleEn: 'New Trade Request!',
      titleAr: 'طلب مقايضة جديد!',
      messageEn: user.name + ' wants to trade with you',
      messageAr: user.name + ' يريد المقايضة معك',
      data: { tradeId: id }
    });

    return { success: true, trade };
  },

  acceptTrade(tradeId) {
    const trade = this.getTradeById(tradeId);
    if (!trade || trade.status !== 'pending') return false;
    trade.status = 'in_escrow';
    trade.escrow.active = true;
    trade.updatedAt = new Date().toISOString();
    PlatformDB._set(tradeId, trade);

    // Freeze coins if applicable
    if (trade.coinOffer > 0) CoinSystem.freezeCoins(trade.partyA, trade.coinOffer, tradeId);

    NotificationData.add(trade.partyA, {
      type: 'trade_accepted',
      titleEn: 'Trade Accepted!',
      titleAr: 'تم قبول المقايضة!',
      messageEn: 'Your trade request was accepted. Confirm delivery to complete.',
      messageAr: 'تم قبول طلب المقايضة. أكّد التسليم لإتمامها.',
      data: { tradeId: tradeId }
    });
    return true;
  },

  rejectTrade(tradeId) {
    const trade = this.getTradeById(tradeId);
    if (!trade || trade.status !== 'pending') return false;
    trade.status = 'cancelled';
    trade.updatedAt = new Date().toISOString();
    PlatformDB._set(tradeId, trade);

    NotificationData.add(trade.partyA, {
      type: 'trade_rejected',
      titleEn: 'Trade Declined',
      titleAr: 'تم رفض المقايضة',
      messageEn: 'Your trade request was declined.',
      messageAr: 'تم رفض طلب المقايضة.',
      data: { tradeId: tradeId }
    });
    return true;
  },

  confirmDelivery(tradeId, party) {
    const trade = this.getTradeById(tradeId);
    if (!trade || trade.status !== 'in_escrow') return false;

    if (party === 'A') trade.escrow.partyAConfirmed = true;
    if (party === 'B') trade.escrow.partyBConfirmed = true;
    trade.updatedAt = new Date().toISOString();
    PlatformDB._set(tradeId, trade);

    if (trade.escrow.partyAConfirmed && trade.escrow.partyBConfirmed) {
      this.completeTrade(tradeId);
    }
    return true;
  },

  openDispute(tradeId, raterId, reason) {
    const trade = this.getTradeById(tradeId);
    if (!trade || trade.status !== 'in_escrow') return false;
    trade.status = 'disputed';
    trade.dispute = {
      openedBy: raterId,
      reason: reason,
      createdAt: new Date().toISOString(),
      resolution: null
    };
    trade.updatedAt = new Date().toISOString();
    PlatformDB._set(tradeId, trade);

    // Notify both parties
    const opener = UserSystem.getUserById(raterId);
    const name = opener ? opener.name : 'الطرف الآخر';
    const parties = [trade.partyA, trade.partyB];
    parties.forEach(uid => {
      NotificationData.add(uid, {
        type: 'trade_disputed',
        titleEn: '⚠️ Trade Disputed!',
        titleAr: '⚠️ نزاع على المقايضة!',
        messageEn: name + ' opened a dispute: ' + reason,
        messageAr: name + ' قام بفتح نزاع: ' + reason,
        data: { tradeId: tradeId }
      });
    });
    return true;
  },

  resolveDispute(tradeId, resolution) {
    const trade = this.getTradeById(tradeId);
    if (!trade || trade.status !== 'disputed') return false;

    trade.dispute.resolution = resolution;
    trade.dispute.resolvedAt = new Date().toISOString();
    trade.updatedAt = new Date().toISOString();

    if (resolution === 'refund') {
      trade.status = 'cancelled';
      if (trade.coinOffer > 0) {
        CoinSystem.unfreezeCoins(trade.partyA, trade.coinOffer, tradeId);
      }
    } else {
      trade.status = 'completed';
      if (trade.coinOffer > 0) {
        CoinSystem.transferCoins(trade.partyA, trade.partyB, trade.coinOffer, tradeId);
      }
      CoinSystem.addCoins(trade.partyA, 15, 'trade_complete');
      CoinSystem.addCoins(trade.partyB, 15, 'trade_complete');

      // Update successful trade stats since it's completed by dispute resolution
      var parties = [trade.partyA, trade.partyB];
      for (var pi = 0; pi < parties.length; pi++) {
        var uid = parties[pi];
        var u = UserSystem.getUserById(uid);
        if (u) {
          u.stats.totalTrades++;
          u.stats.successfulTrades++;
          u.stats.acceptRate = Math.round((u.stats.successfulTrades / Math.max(u.stats.totalTrades, 1)) * 100);
          UserSystem.updateProfile(uid, { stats: u.stats });
          GamificationSystem.updateLevel(uid);
          GamificationSystem.checkAndAwardBadges(uid);
        }
      }
    }
    PlatformDB._set(tradeId, trade);

    // Notify both parties
    const notifyParties = [trade.partyA, trade.partyB];
    notifyParties.forEach(uid => {
      NotificationData.add(uid, {
        type: 'trade_dispute_resolved',
        titleEn: '📢 Dispute Resolved',
        titleAr: '📢 تم حل النزاع',
        messageEn: 'The mediator resolved the dispute. Result: ' + resolution,
        messageAr: 'قام وسيط المنصة بحل النزاع. النتيجة: ' + (resolution === 'refund' ? 'إرجاع السلع والعملات' : 'إتمام الصفقة وتحرير الضمان'),
        data: { tradeId: tradeId }
      });
    });
    return true;
  },

  completeTrade(tradeId) {
    const trade = this.getTradeById(tradeId);
    if (!trade) return false;
    trade.status = 'completed';
    trade.escrow.active = false;
    trade.updatedAt = new Date().toISOString();
    PlatformDB._set(tradeId, trade);

    // Transfer coins
    if (trade.coinOffer > 0) {
      CoinSystem.transferCoins(trade.partyA, trade.partyB, trade.coinOffer, tradeId);
    }

    // Award coins for completing trade
    CoinSystem.addCoins(trade.partyA, 15, 'trade_complete');
    CoinSystem.addCoins(trade.partyB, 15, 'trade_complete');

    // Calculate Carbon Savings
    const co2A = CarbonCalculator.getSavings(trade.listingB.category);
    const co2B = CarbonCalculator.getSavings(trade.listingA.category);

    // Update user stats
    var parties = [trade.partyA, trade.partyB];
    for (var pi = 0; pi < parties.length; pi++) {
      var uid = parties[pi];
      var u = UserSystem.getUserById(uid);
      if (u) {
        u.stats.totalTrades++;
        u.stats.successfulTrades++;
        u.stats.acceptRate = Math.round((u.stats.successfulTrades / Math.max(u.stats.totalTrades, 1)) * 100);
        
        // Add carbon savings
        const saved = uid === trade.partyA ? co2A : co2B;
        u.stats.carbonSaved = (u.stats.carbonSaved || 0) + saved;

        UserSystem.updateProfile(uid, { stats: u.stats });
        GamificationSystem.updateLevel(uid);
        GamificationSystem.checkAndAwardBadges(uid);
      }
    }

    // Deactivate listings
    if (trade.listingA.id) {
      var la = ListingSystem.getListingById(trade.listingA.id);
      if (la) { la.status = 'traded'; PlatformDB._set(trade.listingA.id, la); }
    }
    if (trade.listingB.id) {
      var lb = ListingSystem.getListingById(trade.listingB.id);
      if (lb) { lb.status = 'traded'; PlatformDB._set(trade.listingB.id, lb); }
    }

    // Notify both
    var notifyParties = [trade.partyA, trade.partyB];
    for (var ni = 0; ni < notifyParties.length; ni++) {
      const saved = notifyParties[ni] === trade.partyA ? co2A : co2B;
      NotificationData.add(notifyParties[ni], {
        type: 'trade_completed',
        titleEn: 'Trade Completed! 🎉',
        titleAr: 'تمت المقايضة بنجاح! 🎉',
        messageEn: 'You earned 15 BarterCoins & saved ' + saved + 'kg of CO2!',
        messageAr: 'حصلت على 15 نقطة بارتر ووفرت ' + saved + ' كجم من انبعاثات الكربون!',
        data: { tradeId: tradeId }
      });
    }
    return true;
  },

  getTradeById(id) { return PlatformDB._get(id); },

  getTradesForUser(userId) {
    const keys = PlatformDB._keys('trade_');
    return keys.map(function(k) { return PlatformDB._get(k); })
      .filter(function(t) { return t && (t.partyA === userId || t.partyB === userId); })
      .sort(function(a, b) { return new Date(b.updatedAt) - new Date(a.updatedAt); });
  },

  addTradeMessage(tradeId, senderId, text) {
    const trade = this.getTradeById(tradeId);
    if (!trade) return false;
    trade.messages.push({
      id: 'm_' + Date.now(),
      senderId: senderId,
      text: text,
      timestamp: new Date().toISOString(),
      read: false
    });
    trade.updatedAt = new Date().toISOString();
    PlatformDB._set(tradeId, trade);

    const otherId = trade.partyA === senderId ? trade.partyB : trade.partyA;
    const sender = UserSystem.getUserById(senderId);
    NotificationData.add(otherId, {
      type: 'new_message',
      titleEn: 'New Message',
      titleAr: 'رسالة جديدة',
      messageEn: (sender ? sender.name : 'Someone') + ': ' + text.substring(0, 50),
      messageAr: (sender ? sender.name : 'شخص') + ': ' + text.substring(0, 50),
      data: { tradeId: tradeId }
    });
    return true;
  }
};

// ─── 6. COIN SYSTEM ───
const CoinSystem = {
  getBalance(userId) {
    const user = UserSystem.getUserById(userId);
    return user ? user.barterCoins : 0;
  },

  addCoins(userId, amount, reason) {
    const user = UserSystem.getUserById(userId);
    if (!user) return;
    user.barterCoins = (user.barterCoins || 0) + amount;
    UserSystem.updateProfile(userId, { barterCoins: user.barterCoins });
    this._log(userId, 'credit', amount, reason, user.barterCoins);
  },

  deductCoins(userId, amount, reason) {
    const user = UserSystem.getUserById(userId);
    if (!user || user.barterCoins < amount) return false;
    user.barterCoins -= amount;
    UserSystem.updateProfile(userId, { barterCoins: user.barterCoins });
    this._log(userId, 'debit', amount, reason, user.barterCoins);
    return true;
  },

  transferCoins(fromId, toId, amount, tradeId) {
    if (this.deductCoins(fromId, amount, 'trade_transfer_' + tradeId)) {
      this.addCoins(toId, amount, 'trade_received_' + tradeId);
      return true;
    }
    return false;
  },

  freezeCoins(userId, amount, tradeId) {
    return this.deductCoins(userId, amount, 'escrow_freeze_' + tradeId);
  },

  unfreezeCoins(userId, amount, tradeId) {
    this.addCoins(userId, amount, 'escrow_unfreeze_' + tradeId);
  },

  getTransactionHistory(userId) {
    return PlatformDB._get('coins_history_' + userId) || [];
  },

  _log(userId, type, amount, reason, balanceAfter) {
    const history = this.getTransactionHistory(userId);
    history.unshift({
      id: 'tx_' + Date.now(),
      type: type,
      amount: amount,
      reason: reason,
      balanceAfter: balanceAfter,
      timestamp: new Date().toISOString()
    });
    if (history.length > 100) history.length = 100;
    PlatformDB._set('coins_history_' + userId, history);
  }
};

// ─── 7. NOTIFICATION DATA ───
const NotificationData = {
  add(userId, notification) {
    const notifs = this.getForUser(userId);
    notifs.unshift({
      id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2,3),
      type: notification.type,
      titleEn: notification.titleEn,
      titleAr: notification.titleAr,
      messageEn: notification.messageEn,
      messageAr: notification.messageAr,
      data: notification.data,
      read: false,
      timestamp: new Date().toISOString()
    });
    if (notifs.length > 50) notifs.length = 50;
    PlatformDB._set('notifs_' + userId, notifs);
  },

  getForUser(userId) { return PlatformDB._get('notifs_' + userId) || []; },

  markRead(userId, notifId) {
    const notifs = this.getForUser(userId);
    const n = notifs.find(function(x) { return x.id === notifId; });
    if (n) { n.read = true; PlatformDB._set('notifs_' + userId, notifs); }
  },

  markAllRead(userId) {
    const notifs = this.getForUser(userId);
    notifs.forEach(function(n) { n.read = true; });
    PlatformDB._set('notifs_' + userId, notifs);
  },

  getUnreadCount(userId) {
    return this.getForUser(userId).filter(function(n) { return !n.read; }).length;
  }
};

// ─── 8. RATING SYSTEM (Weighted by Voter Level) ───
const RatingSystem = {
  rateTrade(tradeId, raterId, score, comment) {
    const trade = TradeSystem.getTradeById(tradeId);
    if (!trade || trade.status !== 'completed') return false;

    const raterUser = UserSystem.getUserById(raterId);
    const raterLevel = raterUser ? raterUser.level : 'beginner';
    const weights = { beginner: 1, active: 2.5, pro: 5, expert: 10 };
    const weight = weights[raterLevel] || 1;

    const ratingObj = {
      score: score,
      comment: comment,
      raterId: raterId,
      raterName: raterUser ? raterUser.name : 'Unknown',
      raterLevel: raterLevel,
      weight: weight,
      timestamp: new Date().toISOString()
    };
    
    if (trade.partyA === raterId) trade.rating.byA = ratingObj;
    else if (trade.partyB === raterId) trade.rating.byB = ratingObj;
    else return false;
    PlatformDB._set(tradeId, trade);

    // Recalculate user reputation
    const ratedUserId = trade.partyA === raterId ? trade.partyB : trade.partyA;
    this.recalculateUserReputation(ratedUserId);

    // Trigger notification
    const ratedUser = UserSystem.getUserById(ratedUserId);
    if (ratedUser) {
      var stars = '';
      for (var si = 0; si < score; si++) stars += '⭐';
      NotificationData.add(ratedUserId, {
        type: 'new_rating',
        titleEn: 'New Rating: ' + stars,
        titleAr: 'تقييم جديد: ' + stars,
        messageEn: comment || 'You received a new rating',
        messageAr: comment || 'حصلت على تقييم جديد',
        data: { tradeId: tradeId, score: score }
      });
    }

    GamificationSystem.checkAndAwardBadges(ratedUserId);
    return true;
  },

  recalculateUserReputation(userId) {
    const user = UserSystem.getUserById(userId);
    if (!user) return;
    const ratings = this.getUserRatings(userId);
    if (ratings.length === 0) {
      user.rating = { sum: 0, count: 0, avg: 0 };
    } else {
      let weightedSum = 0;
      let totalWeight = 0;
      ratings.forEach(r => {
        weightedSum += r.score * r.weight;
        totalWeight += r.weight;
      });
      user.rating.sum = ratings.reduce((sum, r) => sum + r.score, 0);
      user.rating.count = ratings.length;
      user.rating.avg = Math.round((weightedSum / totalWeight) * 10) / 10;
    }
    UserSystem.updateProfile(userId, { rating: user.rating });
  },

  getUserRatings(userId) {
    const trades = TradeSystem.getTradesForUser(userId);
    const ratings = [];
    trades.forEach(function(t) {
      if (t.rating.byA && t.partyB === userId) {
        ratings.push({ 
          score: t.rating.byA.score, 
          comment: t.rating.byA.comment, 
          raterId: t.rating.byA.raterId, 
          raterName: t.rating.byA.raterName || 'Someone',
          raterLevel: t.rating.byA.raterLevel || 'beginner',
          weight: t.rating.byA.weight || 1,
          timestamp: t.rating.byA.timestamp, 
          tradeId: t.id 
        });
      }
      if (t.rating.byB && t.partyA === userId) {
        ratings.push({ 
          score: t.rating.byB.score, 
          comment: t.rating.byB.comment, 
          raterId: t.rating.byB.raterId, 
          raterName: t.rating.byB.raterName || 'Someone',
          raterLevel: t.rating.byB.raterLevel || 'beginner',
          weight: t.rating.byB.weight || 1,
          timestamp: t.rating.byB.timestamp, 
          tradeId: t.id 
        });
      }
    });
    return ratings.sort(function(a, b) { return new Date(b.timestamp) - new Date(a.timestamp); });
  }
};

// ─── 9. GAMIFICATION ───
const GamificationSystem = {
  LEVELS: {
    beginner: { labelEn: 'Beginner', labelAr: 'مبتدئ', icon: '🥉', minTrades: 0 },
    active:   { labelEn: 'Active',   labelAr: 'نشط',   icon: '🥈', minTrades: 5 },
    pro:      { labelEn: 'Pro',      labelAr: 'محترف', icon: '🥇', minTrades: 20 },
    expert:   { labelEn: 'Expert',   labelAr: 'خبير',  icon: '💎', minTrades: 50 }
  },

  BADGES: {
    first_trade:   { labelEn: 'First Trade',    labelAr: 'أول مقايضة',   icon: '🎉' },
    ten_trades:    { labelEn: '10 Trades',       labelAr: '10 مقايضات',  icon: '🔟' },
    fast_trader:   { labelEn: 'Fast Trader',     labelAr: 'تاجر سريع',   icon: '⚡' },
    trusted:       { labelEn: 'Trusted',         labelAr: 'موثوق',       icon: '✅' },
    top_earner:    { labelEn: 'Top Earner',      labelAr: 'أعلى ربح',    icon: '💰' },
    referrer:      { labelEn: 'Referrer',        labelAr: 'مُحيل',       icon: '👥' },
    sharia_expert: { labelEn: 'Sharia Expert',   labelAr: 'خبير شرعي',   icon: '☪️' },
    multi_country: { labelEn: 'International',   labelAr: 'دولي',        icon: '🌏' }
  },

  checkAndAwardBadges(userId) {
    const user = UserSystem.getUserById(userId);
    if (!user) return [];
    const newBadges = [];
    var self = this;

    function has(b) { return user.badges.indexOf(b) !== -1; }
    const s = user.stats;

    if (!has('first_trade') && s.successfulTrades >= 1) { user.badges.push('first_trade'); newBadges.push('first_trade'); }
    if (!has('ten_trades') && s.successfulTrades >= 10) { user.badges.push('ten_trades'); newBadges.push('ten_trades'); }
    if (!has('trusted') && user.rating.avg >= 4.5 && user.rating.count >= 5) { user.badges.push('trusted'); newBadges.push('trusted'); }
    if (!has('top_earner') && user.barterCoins >= 500) { user.badges.push('top_earner'); newBadges.push('top_earner'); }
    if (!has('referrer') && (user.referrals ? user.referrals.length : 0) >= 3) { user.badges.push('referrer'); newBadges.push('referrer'); }

    if (newBadges.length) {
      UserSystem.updateProfile(userId, { badges: user.badges });
      newBadges.forEach(function(b) {
        CoinSystem.addCoins(userId, 10, 'badge_' + b);
        var badgeDef = self.BADGES[b];
        NotificationData.add(userId, {
          type: 'badge_earned',
          titleEn: 'Badge Earned: ' + (badgeDef ? badgeDef.icon : '') + ' ' + (badgeDef ? badgeDef.labelEn : b),
          titleAr: 'شارة جديدة: ' + (badgeDef ? badgeDef.icon : '') + ' ' + (badgeDef ? badgeDef.labelAr : b),
          messageEn: 'You earned 10 BarterCoins!',
          messageAr: 'حصلت على 10 نقاط بارتر!',
          data: { badge: b }
        });
      });
    }
    return newBadges;
  },

  updateLevel(userId) {
    const user = UserSystem.getUserById(userId);
    if (!user) return;
    const trades = user.stats.successfulTrades;
    var newLevel = 'beginner';
    if (trades >= 50) newLevel = 'expert';
    else if (trades >= 20) newLevel = 'pro';
    else if (trades >= 5) newLevel = 'active';
    if (user.level !== newLevel) {
      UserSystem.updateProfile(userId, { level: newLevel });
    }
  },

  getLeaderboard() {
    return UserSystem.getAllUsers()
      .sort(function(a, b) { return b.barterCoins - a.barterCoins; })
      .slice(0, 10);
  }
};

// ─── 10. REFERRAL SYSTEM ───
const ReferralSystem = {
  useCode(newUserId, code) {
    const referrerId = PlatformDB._get('refcode_' + code.toUpperCase());
    if (!referrerId) return { success: false, error: 'Invalid code' };
    if (referrerId === newUserId) return { success: false, error: 'Cannot refer yourself' };

    const referrer = UserSystem.getUserById(referrerId);
    const newUser = UserSystem.getUserById(newUserId);
    if (!referrer || !newUser) return { success: false, error: 'User not found' };
    if (newUser.referredBy) return { success: false, error: 'Already used a referral code' };

    // Award coins
    CoinSystem.addCoins(referrerId, 25, 'referral_bonus');
    CoinSystem.addCoins(newUserId, 10, 'referred_bonus');

    // Update records
    referrer.referrals = referrer.referrals || [];
    referrer.referrals.push(newUserId);
    UserSystem.updateProfile(referrerId, { referrals: referrer.referrals });
    UserSystem.updateProfile(newUserId, { referredBy: referrerId });

    NotificationData.add(referrerId, {
      type: 'referral_used',
      titleEn: 'Referral Bonus! 🎁',
      titleAr: 'مكافأة إحالة! 🎁',
      messageEn: newUser.name + ' joined using your code! +25 BC',
      messageAr: newUser.name + ' انضم باستخدام كودك! +25 نقطة',
      data: { userId: newUserId }
    });

    GamificationSystem.checkAndAwardBadges(referrerId);
    return { success: true };
  }
};

// ─── 11. CIRCULAR MATCHING ENGINE (3-Way Trades) ───
const CircularMatchingSystem = {
  findCycles() {
    const listings = ListingSystem.getListings();
    const cycles = [];

    // Group listings by owner
    const listingsByOwner = {};
    listings.forEach(l => {
      if (!listingsByOwner[l.ownerId]) listingsByOwner[l.ownerId] = [];
      listingsByOwner[l.ownerId].push(l);
    });

    const ownerIds = Object.keys(listingsByOwner);
    const n = ownerIds.length;

    // Search for 3-way cycles (distinct owners U1, U2, U3)
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        for (let k = 0; k < n; k++) {
          if (i === k || j === k) continue;

          const u1 = ownerIds[i];
          const u2 = ownerIds[j];
          const u3 = ownerIds[k];

          const list1 = listingsByOwner[u1];
          const list2 = listingsByOwner[u2];
          const list3 = listingsByOwner[u3];

          for (let l1 of list1) {
            for (let l2 of list2) {
              if (l1.desiredCategory && l1.desiredCategory === l2.category) {
                for (let l3 of list3) {
                  if (l2.desiredCategory && l2.desiredCategory === l3.category) {
                    if (l3.desiredCategory && l3.desiredCategory === l1.category) {
                      // Found a cycle: L1 -> L2 -> L3 -> L1
                      const cycleKey = [l1.id, l2.id, l3.id].sort().join('-');
                      if (!cycles.some(c => c.key === cycleKey)) {
                        cycles.push({
                          key: cycleKey,
                          l1: l1,
                          l2: l2,
                          l3: l3,
                          u1: UserSystem.getUserById(u1),
                          u2: UserSystem.getUserById(u2),
                          u3: UserSystem.getUserById(u3)
                        });
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    return cycles;
  }
};

// ─── 12. DEMO DATA SEEDER ───
function seedDemoData() {
  var demoUsers = [
    { name: 'أحمد محمد', email: 'ahmed@demo.com', password: 'demo123', country: 'EG', avatar: '😎' },
    { name: 'سارة العلي', email: 'sara@demo.com', password: 'demo123', country: 'SA', avatar: '🧕' },
    { name: 'محمد خان', email: 'khan@demo.com', password: 'demo123', country: 'AE', avatar: '🧑‍💼' },
    { name: 'ياسر الحمصي', email: 'yasser@demo.com', password: 'demo123', country: 'SY', avatar: '👨‍💼' },
    { name: 'منى الجابري', email: 'mona@demo.com', password: 'demo123', country: 'OM', avatar: '👩‍💼' }
  ];

  var createdUsers = [];
  // Temporarily suppress notifications during seeding
  var origAdd = NotificationData.add;
  NotificationData.add = function() {};

  demoUsers.forEach(function(u) {
    var result = UserSystem.register(u);
    if (result.success) createdUsers.push(result.user);
    UserSystem.logout();
  });

  NotificationData.add = origAdd;

  // Create demo listings
  var demoListings = [
    { userId: 0, type: 'good', category: 'electronics', subcategory: 'smartphones', title: 'iPhone 14 Pro Max', titleAr: 'آيفون 14 برو ماكس', basePrice: 1100, ageYears: 1, condition: 'like_new', demand: 'high', desiredCategory: 'vehicles' },
    { userId: 0, type: 'good', category: 'home_garden', subcategory: 'furniture', title: 'Italian Leather Sofa', titleAr: 'كنبة جلد إيطالي', basePrice: 800, ageYears: 2, condition: 'good', demand: 'normal', desiredCategory: 'electronics' },
    { userId: 1, type: 'good', category: 'fashion', subcategory: 'jewelry', title: 'Gold Necklace 21K', titleAr: 'عقد ذهب 21 قيراط', basePrice: 1500, ageYears: 0, condition: 'new', demand: 'high', desiredCategory: 'electronics' },
    { userId: 1, type: 'service', category: 'education', subcategory: 'languages', title: 'Arabic Tutoring (20h)', titleAr: 'دروس عربي (20 ساعة)', hourlyRate: 30, hours: 20, complexity: 'medium', experience: 'expert', desiredCategory: 'digital' },
    { userId: 2, type: 'good', category: 'electronics', subcategory: 'laptops', title: 'MacBook Pro M2', titleAr: 'ماك بوك برو M2', basePrice: 2000, ageYears: 0.5, condition: 'excellent', demand: 'high', desiredCategory: 'home_garden' }, // Form a cycle: Ahmed wants vehicles, Sara wants electronics, Khan wants home_garden
    { userId: 3, type: 'good', category: 'arts_crafts', subcategory: 'antiques', title: 'Ottoman Copper Set', titleAr: 'طقم نحاسي عثماني', basePrice: 1200, ageYears: 80, condition: 'good', demand: 'normal', desiredCategory: 'fashion' },
    { userId: 3, type: 'service', category: 'services', subcategory: 'web_dev', title: 'Full Website Development', titleAr: 'تطوير موقع ويب كامل', hourlyRate: 40, hours: 50, complexity: 'complex', experience: 'expert', desiredCategory: 'electronics' },
    { userId: 4, type: 'good', category: 'industrial', subcategory: 'tools', title: 'DeWalt Pro Drill Kit', titleAr: 'شنيور ديوالت احترافي', basePrice: 450, ageYears: 1, condition: 'like_new', demand: 'normal', desiredCategory: 'services' },
    { userId: 4, type: 'good', category: 'vehicles', subcategory: 'bicycles', title: 'Trek Mountain Bike', titleAr: 'دراجة تريك جبلية', basePrice: 600, ageYears: 2, condition: 'good', demand: 'normal', desiredCategory: 'electronics' }
  ];

  demoListings.forEach(function(dl) {
    if (!createdUsers[dl.userId]) return;
    PlatformDB._set('current_session', createdUsers[dl.userId].id);
    ListingSystem.createListing(dl);
  });

  // Create 1 completed demo trade with ratings
  if (createdUsers.length >= 2) {
    var userListings0 = ListingSystem.getUserListings(createdUsers[0].id);
    var userListings1 = ListingSystem.getUserListings(createdUsers[1].id);
    if (userListings0.length && userListings1.length) {
      PlatformDB._set('current_session', createdUsers[0].id);
      var tradeResult = TradeSystem.requestTrade({
        listingIdA: userListings0[0].id,
        listingIdB: userListings1[0].id,
        message: 'مرحباً! هل تقبل هذه المقايضة؟'
      });
      if (tradeResult.success) {
        TradeSystem.acceptTrade(tradeResult.trade.id);
        TradeSystem.confirmDelivery(tradeResult.trade.id, 'A');
        TradeSystem.confirmDelivery(tradeResult.trade.id, 'B');
        RatingSystem.rateTrade(tradeResult.trade.id, createdUsers[0].id, 5, 'ممتاز! تجربة رائعة');
        PlatformDB._set('current_session', createdUsers[1].id);
        RatingSystem.rateTrade(tradeResult.trade.id, createdUsers[1].id, 4, 'تجربة جيدة');
      }
    }
  }

  // Logout after seeding
  UserSystem.logout();
}

// ─── INIT SEED ───
// Start loading asynchronously from server
PlatformDB.loadFromServer().then(() => {
  if (!PlatformDB._get('seeded_v5')) {
    seedDemoData();
    PlatformDB._set('seeded_v5', true);
  }
});

// ─── EXPORTS ───
window.PlatformDB = PlatformDB;
window.UserSystem = UserSystem;
window.ListingSystem = ListingSystem;
window.TradeSystem = TradeSystem;
window.CoinSystem = CoinSystem;
window.NotificationData = NotificationData;
window.RatingSystem = RatingSystem;
window.GamificationSystem = GamificationSystem;
window.ReferralSystem = ReferralSystem;
window.CarbonCalculator = CarbonCalculator;
window.CircularMatchingSystem = CircularMatchingSystem;
