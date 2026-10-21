import React, { createContext, useContext, useState } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('aquaallot_user');
    return saved ? JSON.parse(saved) : {
      email: 'admin@aquaallot.com',
      name: 'System Admin',
      role: 'Chief Administrator',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'
    };
  });

  const login = (email, password) => {
    if (email.toLowerCase() === 'admin@aquaallot.com' && password === 'admin123') {
      const adminUser = {
        email: 'admin@aquaallot.com',
        name: 'System Admin',
        role: 'Chief Administrator',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'
      };
      setUser(adminUser);
      localStorage.setItem('aquaallot_user', JSON.stringify(adminUser));
      return { success: true };
    }
    return { success: false, message: 'Invalid credentials. Use admin@aquaallot.com / admin123' };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('aquaallot_user');
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
