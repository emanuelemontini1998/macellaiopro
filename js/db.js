// Database module
export const DB = {
    db: null,
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('MacellaioProDB', 1);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => { this.db = request.result; resolve(); };
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                db.createObjectStore('products', { keyPath: 'id' });
                db.createObjectStore('sales', { keyPath: 'id' });
                db.createObjectStore('waste', { keyPath: 'id' });
            };
        });
    },
    async getAll(store) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(store, 'readonly');
            const req = tx.objectStore(store).getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },
    async put(store, data) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(store, 'readwrite');
            const req = tx.objectStore(store).put(data);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    },
    async delete(store, id) {
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(store, 'readwrite');
            const req = tx.objectStore(store).delete(id);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    }
};
