import React, { useState } from 'react'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
export default function App(){ const [token,setToken]=useState(localStorage.getItem('token')); const onLogin=(t)=>{localStorage.setItem('token',t); setToken(t)}; const onLogout=()=>{localStorage.removeItem('token'); setToken(null)}; return (<div className="min-h-screen flex items-center"><div className="container">{!token? <Login onLogin={onLogin}/> : <Dashboard token={token} onLogout={onLogout}/>}</div></div>)}
