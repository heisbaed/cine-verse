import { getApp, getApps, initializeApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: 'AIzaSyCygvX22E_O1PZv30G34U6H4lGl8v8whkM',
  authDomain: 'cine-verse-231ad.firebaseapp.com',
  databaseURL: 'https://cine-verse-231ad-default-rtdb.firebaseio.com',
  projectId: 'cine-verse-231ad',
  storageBucket: 'cine-verse-231ad.firebasestorage.app',
  messagingSenderId: '284878036405',
  appId: '1:284878036405:web:9741c51c0fda70ccc6cdfc',
};

export const firebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
