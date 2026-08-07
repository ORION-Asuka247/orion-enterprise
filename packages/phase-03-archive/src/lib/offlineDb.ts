import { openDB } from "idb";

export const offlineDb = openDB("orion-engineer", 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains("assignments")) {
      db.createObjectStore("assignments", { keyPath: "id" });
    }
    if (!db.objectStoreNames.contains("assets")) {
      db.createObjectStore("assets", { keyPath: "id" });
    }
    if (!db.objectStoreNames.contains("templates")) {
      db.createObjectStore("templates", { keyPath: "id" });
    }
    if (!db.objectStoreNames.contains("drafts")) {
      db.createObjectStore("drafts", { keyPath: "inspectionId" });
    }
    if (!db.objectStoreNames.contains("syncQueue")) {
      const store = db.createObjectStore("syncQueue", {
        keyPath: "id",
        autoIncrement: true
      });
      store.createIndex("createdAt", "createdAt");
    }
    if (!db.objectStoreNames.contains("blobs")) {
      db.createObjectStore("blobs", { keyPath: "id" });
    }
  }
});
