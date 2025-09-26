import React from 'react'
import { motion } from 'framer-motion'
export default function GameCard({ title, desc, onPlay, children }) { return (<motion.div whileHover={{ y: -6 }} className="card"><div className="flex items-start justify-between"><div><h3 className="text-xl font-bold">{title}</h3><p className="text-sm text-white/70">{desc}</p></div><div>{children}</div></div><div className="mt-4 flex gap-3"><button onClick={onPlay} className="btn">Jogar</button><button className="small-btn">Ver regras</button></div></motion.div>)}
