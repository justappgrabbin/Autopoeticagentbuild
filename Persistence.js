// src/engine/Persistence.js

export class ResonancePersistence {
  constructor() {
    this.db = null;
    this.dbName = 'ResonanceFieldDB';
    this.version = 1;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        if (!db.objectStoreNames.contains('purpose_vectors')) {
          db.createObjectStore('purpose_vectors', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('trajectories')) {
          db.createObjectStore('trajectories', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('drift_alerts')) {
          db.createObjectStore('drift_alerts', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('agent_morphology')) {
          db.createObjectStore('agent_morphology', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('studies')) {
          db.createObjectStore('studies', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('observations')) {
          db.createObjectStore('observations', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('papers')) {
          db.createObjectStore('papers', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('human_success')) {
          db.createObjectStore('human_success', { keyPath: 'id', autoIncrement: true });
        }
      };
    });
  }

  async save(storeName, data) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([storeName], 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.add(data);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async update(storeName, data) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([storeName], 'readwrite');
      const store = tx.objectStore(storeName);
      const request = store.put(data);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAll(storeName) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([storeName], 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getById(storeName, id) {
    if (!this.db) await this.init();
    
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction([storeName], 'readonly');
      const store = tx.objectStore(storeName);
      const request = store.get(id);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}
