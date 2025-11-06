// Storage utilities for TrailNote
// Uses Chrome storage API for persistent data

export const store = {
  async get(key, def=null) {
    return new Promise(res => chrome.storage.local.get([key], x => res(x[key] ?? def)));
  },
  async set(key, val) {
    return new Promise(res => chrome.storage.local.set({[key]: val}, res));
  }
};

// Notes API helpers
export const notesApi = {
  async list() {
    const all = await store.get('notes', []);
    return all.sort((a,b)=> (b.updatedAt||b.createdAt) - (a.updatedAt||a.createdAt));
  },
  async add(note) {
    const all = await store.get('notes', []);
    all.push(note);
    await store.set('notes', all); 
  },
  async saveAll(arr){ await store.set('notes', arr); }
};

