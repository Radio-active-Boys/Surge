// src/stores/storeUserType.js
import { create } from 'zustand';

export const useUserTypeStore = create((set) => ({
  status: 'lite',
  setStatus: (newType) => {
    set({
      status: newType
    });
  },
}));
