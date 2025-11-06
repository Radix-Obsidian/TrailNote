// Minimal token tracker for TrailNote
// Tracks session and daily token usage

const dayKey = () => new Date().toISOString().slice(0,10);

export const tokens = {
  async bump(n) {
    const day = dayKey();
    const data = (await new Promise(res => chrome.storage.local.get(['tokenUsage'], x=>res(x.tokenUsage||{}))));
    data[day] = (data[day]||0) + n;
    data.session = (data.session||0) + n;
    return new Promise(res => chrome.storage.local.set({ tokenUsage: data }, res));
  },
  async get() {
    const data = (await new Promise(res => chrome.storage.local.get(['tokenUsage'], x=>res(x.tokenUsage||{}))));
    const day = dayKey();
    return { today: data[day]||0, session: data.session||0 };
  },
  estimateFromText(txt){ return Math.ceil((txt||'').length / 4); } // rough fallback
};

