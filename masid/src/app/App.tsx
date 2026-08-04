// MASID v2.1 — Production-Grade · UX Best Practices Pass
// DPWH | Philippine Space Agency | Region III

import { useState, useRef, useEffect, useMemo } from "react";
import { Toaster, toast } from "sonner";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Legend,
} from "recharts";
import {
  Map as MapIcon, List, Search, Bell, User, ChevronRight, ChevronLeft,
  ChevronUp, ChevronDown, AlertTriangle, CheckCircle, X, FileText,
  Layers, Filter, Upload, Camera, Flag, Download, Edit2, Menu,
  Calendar, Building2, Banknote, ArrowRight, RefreshCw, ExternalLink,
  Satellite, MessageSquare, ZoomIn, ZoomOut, Check, MapPin, Shield,
  Percent, BarChart2, Plus, LogOut, Settings, Users, Globe, Eye,
  EyeOff, Lock, Activity, Wifi, WifiOff, Star, Clock, TrendingUp,
  TrendingDown, CheckSquare, AlertCircle, Command, Inbox,
} from "lucide-react";

import {
  PROJECTS, CONTRACTORS, META, MUNI_BREAKDOWN, STATUS_PIE, BUDGET_BY_YEAR,
  FLAG_BREAKDOWN, FLAGGED_VALUE, MAP_BOUNDS, FLAG_LABELS, SEVERITY_CFG,
  BOUNDARIES, OFF_MAP, SATELLITE, SAT_BY_ID, SAT_TALLY, VERDICT_CFG, VALIDATION,
  PROCUREMENT, PROC_BY_ID, PROC_FLAG_LABELS, DOC_LABELS, FUSED_BY_ID, QUADRANT_CFG, TRIAGE, PRIORITY,
} from "./data";
import type { Project, Contractor, ProjectStatus } from "./data";
import { FilterPanel } from "./FilterPanel";
import { ENCODINGS, ENCODING_BY_KEY, colorOf, shapeOf, markPath, legendFor, suggestEncoding, BASEMAP, type Encoding, type MarkShape } from "./mapColor";
import { type Filters, emptyFilters, applyFilters, fromQuery, activeCount, toQuery as toQueryString } from "./filters";

// ─── Types ────────────────────────────────────────────────────────────────────

type Screen = "dashboard" | "map" | "project-detail" | "satellite" | "documents" | "citizen-report" | "contractors" | "admin" | "transparency";
type Role = "dpwh-admin" | "dpwh-engineer" | "field-inspector" | "psa-analyst" | "lgu-coordinator" | "public";
type SortDir = "asc" | "desc" | null;

interface Notification { id: number; type: string; title: string; body: string; time: string; read: boolean; }
interface AuditEntry   { user: string; action: string; target: string; time: string; ip: string; }
interface SystemUser   { name: string; role: Role; email: string; lastLogin: string; status: "active"|"inactive"|"suspended"; }

// ─── Data ─────────────────────────────────────────────────────────────────────



const NOTIFICATIONS: Notification[] = [
  { id:1, type:"flag",      title:"Project Auto-Flagged",       body:"BCF-2024-019 flagged — no structure detected in Nov satellite imagery.", time:"4 min ago",  read:false },
  { id:2, type:"deadline",  title:"Deadline in 7 Days",          body:"BCF-2023-062 (Balagtas Embankment) ends Sep 14. Currently at 79%.",       time:"1 hr ago",   read:false },
  { id:3, type:"report",    title:"New Citizen Report",           body:"Anonymous submitted an observation for Bocaue Floodway Expansion.",        time:"2 hrs ago",  read:false },
  { id:4, type:"satellite", title:"New Imagery Available",        body:"Sentinel-2 capture (Nov 15) ready for Norzagaray — 3.2% cloud cover.",    time:"5 hrs ago",  read:true  },
  { id:5, type:"coa",       title:"COA Flag — Budget Mismatch",  body:"BCF-2024-027: ₱2.5M discrepancy in BAC resolution vs contract amount.",    time:"Yesterday",  read:true  },
  { id:6, type:"system",    title:"PAGASA Feed Updated",          body:"Typhoon Carina forecast updated for Region III. 3 projects in high-risk.", time:"Yesterday",  read:true  },
  { id:7, type:"philgeps",  title:"PhilGEPS Sync Complete",       body:"12 new procurement postings matched to active MASID projects.",            time:"2 days ago", read:true  },
];

const SYSTEM_USERS: SystemUser[] = [
  { name:"Ana Reyes",      role:"dpwh-admin",       email:"a.reyes@dpwh.gov.ph",  lastLogin:"Just now",   status:"active"   },
  { name:"Ben Santos",     role:"field-inspector",  email:"b.santos@dpwh.gov.ph", lastLogin:"2 hrs ago",  status:"active"   },
  { name:"Carla Dizon",    role:"psa-analyst",      email:"c.dizon@psa.gov.ph",   lastLogin:"Yesterday",  status:"active"   },
  { name:"David Lim",      role:"lgu-coordinator",  email:"d.lim@bulacan.gov.ph", lastLogin:"3 days ago", status:"inactive" },
  { name:"Elena Cruz",     role:"dpwh-engineer",    email:"e.cruz@dpwh.gov.ph",   lastLogin:"1 hr ago",   status:"active"   },
  { name:"Francis Ocampo", role:"dpwh-engineer",    email:"f.ocampo@dpwh.gov.ph", lastLogin:"4 days ago", status:"suspended"},
];

const AUDIT_LOG: AuditEntry[] = [
  { user:"A. Reyes",  action:"Flagged project",            target:"BCF-2024-019",             time:"2024-11-14 09:23", ip:"192.168.1.102" },
  { user:"B. Santos", action:"Uploaded document",          target:"ProgReport_BCF-2024-033",  time:"2024-11-14 08:45", ip:"192.168.1.88"  },
  { user:"C. Dizon",  action:"Added satellite annotation", target:"BCF-2024-001 — confirmed", time:"2024-11-13 16:02", ip:"203.177.12.34" },
  { user:"A. Reyes",  action:"Approved document",          target:"Contract_BCF-2022-088",    time:"2024-11-13 14:30", ip:"192.168.1.102" },
  { user:"E. Cruz",   action:"Updated completion %",       target:"BCF-2024-033 → 48%",       time:"2024-11-13 11:15", ip:"192.168.1.75"  },
  { user:"B. Santos", action:"Submitted inspection",       target:"BCF-2024-001 Site Visit",  time:"2024-11-12 15:50", ip:"192.168.1.88"  },
  { user:"A. Reyes",  action:"Created project",            target:"BCF-2025-011",             time:"2024-11-11 10:00", ip:"192.168.1.102" },
];


const INTEGRATIONS = [
  { name:"PAGASA Rainfall API",       status:"live",     lastSync:"2 min ago",  icon:"🌧️" },
  { name:"PSA / Diwata-2 Feed",       status:"live",     lastSync:"4 hrs ago",  icon:"🛰️" },
  { name:"ESA Copernicus / Sentinel", status:"live",     lastSync:"12 hrs ago", icon:"🌍" },
  { name:"NAMRIA Basemap Tiles",      status:"live",     lastSync:"Real-time",  icon:"🗺️" },
  { name:"PhilGEPS Procurement Data", status:"degraded", lastSync:"2 days ago", icon:"📋" },
  { name:"COA Audit Database",        status:"offline",  lastSync:"Never",      icon:"📁" },
  { name:"PhilSys ID Verification",   status:"live",     lastSync:"Real-time",  icon:"🪪" },
  { name:"NDRRMC Alert Feed",         status:"live",     lastSync:"8 min ago",  icon:"🚨" },
];

// Chart series are derived from the real records in ../data — see MUNI_BREAKDOWN,
// STATUS_PIE, BUDGET_BY_YEAR and FLAG_BREAKDOWN there.
// ─── Config Maps ──────────────────────────────────────────────────────────────

const STATUS_CFG: Record<ProjectStatus,{label:string;dot:string;bg:string;text:string}> = {
  completed: { label:"Completed",          dot:"#16a34a", bg:"#dcfce7", text:"#15803d" },
  ongoing:   { label:"Ongoing",            dot:"#2563eb", bg:"#dbeafe", text:"#1d4ed8" },
  flagged:   { label:"Flagged for Review", dot:"#f59e0b", bg:"#fef3c7", text:"#b45309" },
  proposed:  { label:"Proposed",           dot:"#94a3b8", bg:"#f1f5f9", text:"#64748b" },
  terminated:{ label:"Terminated",         dot:"#dc2626", bg:"#fee2e2", text:"#b91c1c" },
};
const ROLE_CFG: Record<Role,{label:string;bg:string}> = {
  "dpwh-admin":     { label:"DPWH Admin",       bg:"#1e3a7b" },
  "dpwh-engineer":  { label:"DPWH Engineer",    bg:"#2563eb" },
  "field-inspector":{ label:"Field Inspector",  bg:"#0f766e" },
  "psa-analyst":    { label:"PSA Analyst",      bg:"#7c3aed" },
  "lgu-coordinator":{ label:"LGU Coordinator",  bg:"#b45309" },
  "public":         { label:"Public",           bg:"#64748b" },
};

// ─── Pure helpers ─────────────────────────────────────────────────────────────

const peso     = (n:number) => n >= 1_000_000_000 ? `₱${(n/1_000_000_000).toFixed(1)}B` : n >= 1_000_000 ? `₱${(n/1_000_000).toFixed(1)}M` : `₱${(n/1000).toFixed(0)}K`;
const pesoFull = (n:number) => `₱${n.toLocaleString("en-PH")}`;
const confColor= (c:number) => c >= 90 ? "#16a34a" : c >= 70 ? "#f59e0b" : "#dc2626";

// Extent comes from the published coordinates themselves, so the canvas always
// frames the real data rather than a hand-picked box.
const MB = { ...MAP_BOUNDS, W:720, H:580 };
const toXY = (lng:number, lat:number) => ({
  x:((lng-MB.minLng)/(MB.maxLng-MB.minLng))*MB.W,
  y:MB.H-((lat-MB.minLat)/(MB.maxLat-MB.minLat))*MB.H,
});

function sortRows<T>(arr:T[], key:keyof T|null, dir:SortDir):T[] {
  if(!key||!dir) return arr;
  return [...arr].sort((a,b)=>{
    const av=a[key], bv=b[key];
    if(typeof av==="number"&&typeof bv==="number") return dir==="asc"?av-bv:bv-av;
    return dir==="asc"?String(av).localeCompare(String(bv)):String(bv).localeCompare(String(av));
  });
}

// ─── Custom hooks ─────────────────────────────────────────────────────────────

function useSort<T>(initial:keyof T|null=null) {
  const [sortKey, setSortKey] = useState<keyof T|null>(initial);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const toggle = (key:keyof T) => {
    if(sortKey===key) setSortDir(d=>d==="asc"?"desc":d==="desc"?null:"asc");
    else { setSortKey(key); setSortDir("asc"); }
  };
  const apply = useMemo(()=>(arr:T[])=>sortRows(arr, sortKey, sortDir), [sortKey, sortDir]);
  return { sortKey, sortDir, toggle, apply };
}

function usePagination(total:number, pageSize=10) {
  const [page,setPage]=useState(1);
  const totalPages=Math.max(1,Math.ceil(total/pageSize));
  return {
    page, pageSize, totalPages,
    setPage: (p:number) => setPage(Math.min(Math.max(1,p), Math.max(1,Math.ceil(total/pageSize)))),
    // Trailing comma disambiguates the type parameter from a JSX tag in .tsx.
    paginate:<T,>(arr:T[])=>arr.slice((page-1)*pageSize,page*pageSize),
    reset:()=>setPage(1),
  };
}

// ─── Shared UI primitives ─────────────────────────────────────────────────────

/**
 * Renders why a record was flagged.
 *
 * The wording is deliberate. Each entry states a discrepancy between published
 * records and stops there — it never claims a project was not built, and never
 * uses the word fraud. Whether anything is actually missing on the ground is a
 * question for imagery and inspection, neither of which has run yet.
 */
function AuditFlags({project,compact=false}:{project:Project;compact?:boolean}) {
  if(!project.auditFlags.length) return null;
  return (
    <div className={compact?"space-y-1.5":"space-y-2"}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
        <Flag size={11}/>Consistency checks tripped
        <span className="font-mono bg-gray-100 text-gray-500 px-1.5 rounded normal-case tracking-normal">{project.auditFlags.length}</span>
      </div>
      {project.auditFlags.map(f=>{
        const s=SEVERITY_CFG[f.severity];
        return (
          <div key={f.code} className="rounded border p-2.5 text-[11px]" style={{background:s.bg,borderColor:s.color+"33",color:s.color}}>
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={11}/>
              <span className="font-semibold">{FLAG_LABELS[f.code]??f.code}</span>
              <span className="ml-auto font-mono text-[9px] uppercase tracking-wider opacity-70">{s.label}</span>
            </div>
            <div className="text-gray-700 leading-relaxed">{f.detail}</div>
          </div>
        );
      })}
      <p className="text-[10px] text-gray-400 leading-relaxed">
        A flag means the published record disagrees with itself or with official
        boundary data. It is a reason to look, not a finding.
      </p>
    </div>
  );
}

function StatusBadge({status,size="sm"}:{status:ProjectStatus;size?:"sm"|"md"}) {
  const c=STATUS_CFG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 font-medium rounded ${size==="md"?"px-2.5 py-1 text-xs":"px-2 py-0.5 text-[11px]"}`}
      style={{background:c.bg,color:c.text}}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{background:c.dot}}/>
      {c.label}
    </span>
  );
}

function SortTh<T>({col,label,sortKey,sortDir,onSort,className=""}:{
  col:keyof T; label:string; sortKey:keyof T|null; sortDir:SortDir; onSort:(k:keyof T)=>void; className?:string;
}) {
  const active=sortKey===col;
  return (
    <th className={`text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap select-none ${className}`}>
      <button onClick={()=>onSort(col)}
        className={`flex items-center gap-1 hover:text-gray-600 transition-colors ${active?"text-[#1e3a7b]":""}`}>
        {label}
        <span className="flex flex-col -space-y-1 ml-0.5">
          <ChevronUp   size={8} className={active&&sortDir==="asc"?"text-[#1e3a7b]":"text-gray-300"}/>
          <ChevronDown size={8} className={active&&sortDir==="desc"?"text-[#1e3a7b]":"text-gray-300"}/>
        </span>
      </button>
    </th>
  );
}

function Pagination({page,totalPages,setPage,total,pageSize}:{
  page:number; totalPages:number; setPage:(p:number)=>void; total:number; pageSize:number;
}) {
  if(totalPages<=1) return null;
  const pages=Array.from({length:Math.min(totalPages,5)},(_,i)=>{
    if(totalPages<=5) return i+1;
    if(page<=3) return i+1;
    if(page>=totalPages-2) return totalPages-4+i;
    return page-2+i;
  });
  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50">
      <span className="text-[12px] text-gray-500">
        Showing {Math.min((page-1)*pageSize+1,total)}–{Math.min(page*pageSize,total)} of {total}
      </span>
      <div className="flex items-center gap-1">
        <button onClick={()=>setPage(1)}      disabled={page===1} className="px-2 py-1 text-[12px] rounded border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed">«</button>
        <button onClick={()=>setPage(page-1)} disabled={page===1} className="px-2 py-1 text-[12px] rounded border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed">‹</button>
        {pages.map(p=>(
          <button key={p} onClick={()=>setPage(p)}
            className={`w-8 h-7 text-[12px] rounded border font-medium transition-colors ${p===page?"bg-[#1e3a7b] text-white border-[#1e3a7b]":"border-gray-200 text-gray-600 hover:bg-white"}`}>
            {p}
          </button>
        ))}
        <button onClick={()=>setPage(page+1)} disabled={page===totalPages} className="px-2 py-1 text-[12px] rounded border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed">›</button>
        <button onClick={()=>setPage(totalPages)} disabled={page===totalPages} className="px-2 py-1 text-[12px] rounded border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed">»</button>
      </div>
    </div>
  );
}

function EmptyState({title,body,action,onAction}:{title:string;body:string;action?:string;onAction?:()=>void}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <Inbox size={24} className="text-gray-300"/>
      </div>
      <div className="text-[14px] font-semibold text-gray-600 mb-1">{title}</div>
      <p className="text-[13px] text-gray-400 max-w-xs">{body}</p>
      {action&&onAction&&(
        <button onClick={onAction}
          className="mt-4 px-4 py-2 text-[13px] font-medium text-white rounded hover:opacity-90"
          style={{background:"#1e3a7b"}}>
          {action}
        </button>
      )}
    </div>
  );
}

function FilterChip({label,onRemove}:{label:string;onRemove:()=>void}) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border border-[#1e3a7b]/20 text-[#1e3a7b]"
      style={{background:"#eef2f9"}}>
      {label}
      <button onClick={onRemove} className="hover:text-red-500 transition-colors ml-0.5">
        <X size={10}/>
      </button>
    </span>
  );
}

function ConfirmDialog({title,body,confirmLabel,danger,onConfirm,onCancel}:{
  title:string;body:string;confirmLabel:string;danger?:boolean;onConfirm:()=>void;onCancel:()=>void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{background:"rgba(13,31,60,0.45)"}}>
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${danger?"bg-red-100":"bg-amber-100"}`}>
            <AlertTriangle size={16} className={danger?"text-red-600":"text-amber-600"}/>
          </div>
          <div>
            <div className="text-[14px] font-bold text-gray-900">{title}</div>
            <p className="text-[13px] text-gray-500 mt-1">{body}</p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-4 py-2 text-[13px] border border-gray-200 rounded text-gray-600 hover:bg-gray-50">Cancel</button>
          <button onClick={()=>{onConfirm();onCancel();}}
            className={`px-4 py-2 text-[13px] font-semibold text-white rounded hover:opacity-90 ${danger?"bg-red-600":"bg-amber-600"}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Command Palette ──────────────────────────────────────────────────────────

type CmdAction = { group: string; icon: React.ReactNode; label: string; run: () => void };

function buildCmdActions(onNavigate:(s:Screen)=>void, onCreate:()=>void): CmdAction[] {
  return [
    { group:"Navigate",  icon:<MapIcon size={14}/>,    label:"Go to Map Dashboard",        run:()=>onNavigate("map") },
    { group:"Navigate",  icon:<BarChart2 size={14}/>,  label:"Go to Analytics Dashboard",  run:()=>onNavigate("dashboard") },
    { group:"Navigate",  icon:<Satellite size={14}/>,  label:"Go to Satellite Monitoring", run:()=>onNavigate("satellite") },
    { group:"Navigate",  icon:<FileText size={14}/>,   label:"Go to Documents",            run:()=>onNavigate("documents") },
    { group:"Navigate",  icon:<Camera size={14}/>,     label:"Go to Citizen Reports",      run:()=>onNavigate("citizen-report") },
    { group:"Navigate",  icon:<Building2 size={14}/>,  label:"Go to Contractor Registry",  run:()=>onNavigate("contractors") },
    { group:"Navigate",  icon:<Settings size={14}/>,   label:"Go to Admin Panel",          run:()=>onNavigate("admin") },
    { group:"Navigate",  icon:<Globe size={14}/>,      label:"Open Transparency Portal",   run:()=>onNavigate("transparency") },
    { group:"Actions",   icon:<Plus size={14}/>,       label:"Create New Project",         run:onCreate },
    { group:"Actions",   icon:<Upload size={14}/>,     label:"Upload Document",            run:()=>toast.success("Upload dialog opened") },
    { group:"Actions",   icon:<RefreshCw size={14}/>,  label:"Sync PhilGEPS Data",         run:()=>toast.info("Syncing PhilGEPS…") },
    { group:"Actions",   icon:<Download size={14}/>,   label:"Export All Projects (CSV)",  run:()=>toast.success("Exporting…") },
    ...PROJECTS.slice(0,5).map<CmdAction>(p=>({ group:"Projects", icon:<MapPin size={14}/>, label:p.name, run:()=>onNavigate("project-detail") })),
  ];
}

function CommandPalette({onClose,onNavigate,onCreate}:{onClose:()=>void;onNavigate:(s:Screen)=>void;onCreate:()=>void}) {
  const [q,setQ]=useState("");
  const [idx,setIdx]=useState(0);
  const inputRef=useRef<HTMLInputElement>(null);
  const actions=useMemo(()=>buildCmdActions(onNavigate,onCreate),[onNavigate,onCreate]);
  const filtered=useMemo(()=>q?actions.filter(a=>a.label.toLowerCase().includes(q.toLowerCase())):actions,[q,actions]);
  const groups=[...new Set(filtered.map(a=>a.group))];

  useEffect(()=>{ inputRef.current?.focus(); },[]);
  useEffect(()=>setIdx(0),[q]);

  const handleKey=(e:React.KeyboardEvent)=>{
    if(e.key==="ArrowDown"){e.preventDefault();setIdx(i=>Math.min(i+1,filtered.length-1));}
    else if(e.key==="ArrowUp"){e.preventDefault();setIdx(i=>Math.max(i-1,0));}
    else if(e.key==="Enter"){e.preventDefault();filtered[idx]?.run();onClose();}
    else if(e.key==="Escape") onClose();
  };

  let flat=0;
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[12vh]" style={{background:"rgba(13,31,60,0.5)"}}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200" onKeyDown={handleKey}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <Search size={16} className="text-gray-400 shrink-0"/>
          <input ref={inputRef} value={q} onChange={e=>setQ(e.target.value)} placeholder="Search commands, projects, actions…"
            className="flex-1 text-[14px] text-gray-800 placeholder-gray-400 focus:outline-none bg-transparent"/>
          <kbd className="text-[10px] font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200">ESC</kbd>
        </div>
        <div className="overflow-auto" style={{maxHeight:400,scrollbarWidth:"none"}}>
          {filtered.length===0&&(
            <div className="py-10 text-center text-[13px] text-gray-400">No commands matching "{q}"</div>
          )}
          {groups.map(group=>{
            const items=filtered.filter(a=>a.group===group);
            return (
              <div key={group}>
                <div className="px-4 pt-3 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{group}</div>
                {items.map(a=>{
                  const i=flat++;
                  return (
                    <button key={a.label} onClick={()=>{a.run();onClose();}}
                      onMouseEnter={()=>setIdx(i)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${idx===i?"bg-[#eef2f9]":""}`}>
                      <span className={`shrink-0 ${idx===i?"text-[#1e3a7b]":"text-gray-400"}`}>{a.icon}</span>
                      <span className={`text-[13px] ${idx===i?"font-medium text-[#1e3a7b]":"text-gray-700"}`}>{a.label}</span>
                      {idx===i&&<span className="ml-auto text-[10px] font-mono text-gray-400">↵</span>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-gray-100 bg-gray-50 text-[11px] text-gray-400">
          <span className="flex items-center gap-1"><kbd className="font-mono bg-gray-200 px-1 rounded">↑↓</kbd>navigate</span>
          <span className="flex items-center gap-1"><kbd className="font-mono bg-gray-200 px-1 rounded">↵</kbd>select</span>
          <span className="flex items-center gap-1"><kbd className="font-mono bg-gray-200 px-1 rounded">esc</kbd>close</span>
          <span className="ml-auto flex items-center gap-1"><Command size={10}/><kbd className="font-mono bg-gray-200 px-1 rounded">K</kbd>to open</span>
        </div>
      </div>
    </div>
  );
}

// ─── Map components ───────────────────────────────────────────────────────────

function MapMarker({p,selected,onClick,fill,shape}:{p:Project&{lat:number;lng:number};selected:boolean;onClick:()=>void;fill:string;shape:MarkShape}) {
  const [hov,setHov]=useState(false);
  const {x,y}=toXY(p.lng,p.lat);
  const c={dot:fill};
  return (
    <g transform={`translate(${x},${y})`} onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)} style={{cursor:"pointer"}} role="button" aria-label={p.name}>
      
      {selected&&<circle r={12} fill="none" stroke={c.dot} strokeWidth={2} opacity={0.85}/>}
      <path d={markPath(shape,selected?7:4.8)} fill={c.dot} stroke={BASEMAP.surface} strokeWidth={2} strokeLinejoin="round"/>
      {hov&&!selected&&(
        <g transform="translate(12,-44)">
          <rect x={0} y={0} width={172} height={40} rx={4} fill="white" style={{filter:"drop-shadow(0 2px 10px rgba(0,0,0,.18))"}}/>
          <text x={8} y={16} fontSize={10.5} fontWeight={600} fill="#0d1f3c" style={{fontFamily:"Inter, sans-serif"}}>{p.name.length>26?p.name.slice(0,26)+"…":p.name}</text>
          <text x={8} y={32} fontSize={9.5} fill="#64748b" style={{fontFamily:"Inter, sans-serif"}}>{p.municipality} · {peso(p.budget)}</text>
        </g>
      )}
    </g>
  );
}

/**
 * Bulacan drawn from geoBoundaries ADM3 polygons — the same boundaries the
 * pipeline reverse-geocodes against. The mock drew a decorative province blob;
 * a map whose flags read "this coordinate is in the wrong municipality" has to
 * show the actual lines that judgement was made against.
 */
function MapSVG({projects,selectedId,onSelect,enc}:{projects:Project[];selectedId:string;onSelect:(id:string)=>void;enc:Encoding}) {
  const ringPath=(ring:[number,number][])=>
    ring.map(([lng,lat],i)=>{const{x,y}=toXY(lng,lat);return `${i?"L":"M"}${x.toFixed(1)},${y.toFixed(1)}`;}).join("")+"Z";
  const paths=useMemo(()=>BOUNDARIES.map(b=>({
    name:b.name,
    d:b.rings.map(ringPath).join(" "),
    served:META.coverage.municipalitiesServed.includes(b.name),
    label:(()=>{
      const pts=b.rings.flat();
      const cx=pts.reduce((s,p)=>s+p[0],0)/pts.length;
      const cy=pts.reduce((s,p)=>s+p[1],0)/pts.length;
      return toXY(cx,cy);
    })(),
  })),[]);
  const step=(v:number)=>Math.round(v*10)/10;
  const glats:number[]=[]; for(let v=step(MB.minLat);v<=MB.maxLat;v+=0.1) glats.push(step(v));
  const glngs:number[]=[]; for(let v=step(MB.minLng);v<=MB.maxLng;v+=0.1) glngs.push(step(v));
  return (
    <svg viewBox={`0 0 ${MB.W} ${MB.H}`} className="w-full h-full" aria-label="Map of Bulacan Province with flood control project locations" role="img">
      <rect width={MB.W} height={MB.H} fill={BASEMAP.surface}/>
      {glats.map(lat=>{const{y}=toXY(MB.minLng,lat);return(<g key={`la${lat}`}><line x1={0} y1={y} x2={MB.W} y2={y} stroke={BASEMAP.grid} strokeWidth={0.35} strokeDasharray="4,5"/><text x={5} y={y-3} fontSize={7} fill={BASEMAP.label} fontFamily="DM Mono,monospace">{lat.toFixed(1)}°N</text></g>);})}
      {glngs.map(lng=>{const{x}=toXY(lng,MB.minLat);return(<g key={`ln${lng}`}><line x1={x} y1={0} x2={x} y2={MB.H} stroke={BASEMAP.grid} strokeWidth={0.35} strokeDasharray="4,5"/><text x={x+3} y={MB.H-6} fontSize={7} fill={BASEMAP.label} fontFamily="DM Mono,monospace">{lng.toFixed(1)}°E</text></g>);})}
      {/* Municipalities this district office's own records describe are filled;
          the rest of the province is drawn but left pale for context. */}
      {paths.map(p=><path key={p.name} d={p.d} fill={p.served?BASEMAP.servedFill:BASEMAP.otherFill} stroke={BASEMAP.stroke} strokeWidth={p.served?0.9:0.4} strokeOpacity={p.served?0.85:0.4}/>)}
      {paths.filter(p=>p.served).map(p=>(
        <text key={`t${p.name}`} x={p.label.x} y={p.label.y} textAnchor="middle" fontSize={7} fill={BASEMAP.label} fontFamily="Inter,sans-serif" fontWeight={700} letterSpacing={0.5} style={{userSelect:"none",pointerEvents:"none"}}>
          {p.name.replace("City of ","").toUpperCase()}
        </text>
      ))}
      {projects.filter(p=>p.lat!=null&&p.lng!=null
        &&p.lat>=MB.minLat&&p.lat<=MB.maxLat&&p.lng>=MB.minLng&&p.lng<=MB.maxLng)
        .map(p=><MapMarker key={p.id} p={p as Project&{lat:number;lng:number}} selected={selectedId===p.id} onClick={()=>onSelect(selectedId===p.id?"":p.id)} fill={colorOf(p,enc)} shape={shapeOf(p,enc)}/>)}
      {/* Scale bar measured from the current extent — a fixed "10 km" label would
          be wrong the moment the bounds change. */}
      {(()=>{
        const midLat=(MB.minLat+MB.maxLat)/2;
        const kmPerPx=((MB.maxLng-MB.minLng)*111.32*Math.cos(midLat*Math.PI/180))/MB.W;
        const km=[1,2,5,10,20,50].reverse().find(k=>k/kmPerPx<=110)??1;
        const w=km/kmPerPx;
        return (
          <g transform={`translate(70,${MB.H-32})`}>
            <rect x={-8} y={-3} width={w+16} height={18} rx={3} fill="white" opacity={0.88}/>
            <line x1={0} y1={8} x2={w} y2={8} stroke="#1e3a7b" strokeWidth={1.5}/>
            <line x1={0} y1={5} x2={0} y2={11} stroke="#1e3a7b" strokeWidth={1.5}/>
            <line x1={w} y1={5} x2={w} y2={11} stroke="#1e3a7b" strokeWidth={1.5}/>
            <text x={w/2} y={6} textAnchor="middle" fontSize={7} fill="#1e3a7b" fontFamily="DM Mono,monospace" dominantBaseline="auto">{km} km</text>
          </g>
        );
      })()}
      <g transform={`translate(${MB.W-40},26)`}><circle r={15} fill="white" opacity={0.88}/><polygon points="0,-11 -4,-2 4,-2" fill="#1e3a7b"/><line x1={0} y1={-2} x2={0} y2={10} stroke="#1e3a7b" strokeWidth={1.5}/><text x={0} y={-13} textAnchor="middle" fontSize={9} fill="#1e3a7b" fontFamily="Inter,sans-serif" fontWeight={700}>N</text></g>
    </svg>
  );
}

// ─── Login Screen ─────────────────────────────────────────────────────────────

function LoginScreen({onLogin}:{onLogin:(role:Role)=>void}) {
  const [email,setEmail]=useState("a.reyes@dpwh.gov.ph");
  const [password,setPassword]=useState("••••••••");
  const [showPw,setShowPw]=useState(false);
  const [role,setRole]=useState<Role>("dpwh-admin");
  const [loading,setLoading]=useState(false);
  const [errors,setErrors]=useState<{email?:string;password?:string}>({});

  const validate=()=>{
    const e:typeof errors={};
    if(!email.includes("@")) e.email="Enter a valid email address";
    if(password.length<4)    e.password="Password is required";
    setErrors(e);
    return Object.keys(e).length===0;
  };

  const handleSubmit=(e:React.FormEvent)=>{
    e.preventDefault();
    if(!validate()) return;
    setLoading(true);
    setTimeout(()=>{setLoading(false);onLogin(role);},1000);
  };

  const roles:[Role,string][]=[["dpwh-admin","DPWH Administrator"],["dpwh-engineer","DPWH District Engineer"],["field-inspector","Field Inspector"],["psa-analyst","PSA Satellite Analyst"],["lgu-coordinator","LGU Coordinator"],["public","Public / Citizen"]];

  return (
    <div className="h-screen w-screen flex overflow-hidden" style={{fontFamily:"Inter, sans-serif"}}>
      <div className="w-[460px] shrink-0 flex flex-col justify-between p-10 relative overflow-hidden" style={{background:"linear-gradient(160deg,#0d2352 0%,#1e3a7b 55%,#1a4a8a 100%)"}}>
        <div className="absolute inset-0 opacity-[0.05]" style={{backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(255,255,255,1) 39px,rgba(255,255,255,1) 40px),repeating-linear-gradient(90deg,transparent,transparent 39px,rgba(255,255,255,1) 39px,rgba(255,255,255,1) 40px)"}}/>
        <div className="relative">
          <div className="flex items-center gap-3 mb-10">
            <div className="w-9 h-9 rounded flex items-center justify-center" style={{background:"#f59e0b"}}><Shield size={18} style={{color:"#1e3a7b"}}/></div>
            <div><div className="text-white font-bold text-lg tracking-widest">MASID</div><div className="text-white/40 tracking-wider" style={{fontSize:8}}>FLOOD CONTROL MONITORING</div></div>
          </div>
          <h2 className="text-white text-3xl font-bold leading-tight mb-3">Infrastructure<br/>Monitoring for<br/>the Philippines</h2>
          <p className="text-white/50 text-sm leading-relaxed">An integrated platform for DPWH flood control tracking, satellite monitoring, procurement transparency, and citizen engagement.</p>
        </div>
        <div className="relative grid grid-cols-2 gap-3">
          {[
            {l:"Projects Loaded",  v:META.coverage.projects.toLocaleString()},
            {l:"Contract Value",   v:peso(META.coverage.totalBudget)},
            {l:"Flagged Records",  v:META.coverage.flagged.toLocaleString()},
            {l:"Contractors",      v:META.coverage.contractors.toLocaleString()},
          ].map(s=>(
            <div key={s.l} className="rounded p-3" style={{background:"rgba(255,255,255,0.07)"}}>
              <div className="text-white font-mono font-bold text-xl">{s.v}</div>
              <div className="text-white/40 text-[11px] mt-0.5">{s.l}</div>
            </div>
          ))}
        </div>
        <div className="relative text-white/25 text-[11px]">Dept. of Public Works and Highways · Philippine Space Agency · Region III · DICT GovCloud PH</div>
      </div>

      <div className="flex-1 flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-sm px-4">
          <div className="mb-8"><h3 className="text-2xl font-bold text-gray-900 mb-1">Sign in to MASID</h3><p className="text-sm text-gray-500">Use your DPWH or agency credentials</p></div>
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label htmlFor="email" className="block text-[12px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Email Address</label>
              <input id="email" value={email} onChange={e=>{setEmail(e.target.value);setErrors(p=>({...p,email:undefined}));}} type="email" autoComplete="email"
                className={`w-full px-3 py-2.5 text-sm border rounded bg-white text-gray-800 focus:outline-none focus:border-[#1e3a7b] transition-colors ${errors.email?"border-red-400":"border-gray-200"}`}/>
              {errors.email&&<p className="text-[11px] text-red-500 mt-1">{errors.email}</p>}
            </div>
            <div>
              <label htmlFor="password" className="block text-[12px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Password</label>
              <div className="relative">
                <input id="password" value={password} onChange={e=>{setPassword(e.target.value);setErrors(p=>({...p,password:undefined}));}} type={showPw?"text":"password"} autoComplete="current-password"
                  className={`w-full px-3 py-2.5 pr-10 text-sm border rounded bg-white text-gray-800 focus:outline-none focus:border-[#1e3a7b] transition-colors ${errors.password?"border-red-400":"border-gray-200"}`}/>
                <button type="button" onClick={()=>setShowPw(v=>!v)} aria-label={showPw?"Hide password":"Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none">
                  {showPw?<EyeOff size={15}/>:<Eye size={15}/>}
                </button>
              </div>
              {errors.password&&<p className="text-[11px] text-red-500 mt-1">{errors.password}</p>}
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded p-3">
              <div className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Activity size={11}/>Demo — Select Role</div>
              <select value={role} onChange={e=>setRole(e.target.value as Role)} className="w-full text-sm border border-blue-200 rounded px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none">
                {roles.map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <button type="submit" disabled={loading} aria-busy={loading}
              className="w-full py-3 text-white text-sm font-semibold rounded flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60 transition-opacity focus:outline-none focus:ring-2 focus:ring-[#1e3a7b] focus:ring-offset-2"
              style={{background:"#1e3a7b"}}>
              {loading?<><RefreshCw size={15} className="animate-spin"/>Signing in…</>:<><Lock size={15}/>Sign In</>}
            </button>
            <div className="flex items-center gap-3"><div className="flex-1 h-px bg-gray-200"/><span className="text-[11px] text-gray-400">or</span><div className="flex-1 h-px bg-gray-200"/></div>
            <button type="button" onClick={()=>onLogin("public")}
              className="w-full py-2.5 text-sm font-medium border border-gray-200 rounded text-gray-600 hover:bg-gray-50 flex items-center justify-center gap-2 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300">
              <Globe size={14}/>View Public Transparency Portal
            </button>
          </form>
          <p className="text-center text-[11px] text-gray-400 mt-8">Protected by DICT GovCloud PH · Data Privacy Act RA 10173</p>
        </div>
      </div>
    </div>
  );
}

// ─── Notifications Panel ──────────────────────────────────────────────────────

function NotificationsPanel({onClose,notifications,onMarkAllRead}:{onClose:()=>void;notifications:Notification[];onMarkAllRead:()=>void}) {
  const iconMap: Record<string,React.ReactNode>={
    flag:<Flag size={13} className="text-amber-500"/>,deadline:<Clock size={13} className="text-red-500"/>,
    report:<Camera size={13} className="text-blue-500"/>,satellite:<Satellite size={13} className="text-purple-500"/>,
    coa:<AlertTriangle size={13} className="text-red-600"/>,system:<Activity size={13} className="text-gray-500"/>,
    philgeps:<FileText size={13} className="text-green-600"/>,
  };
  const unread=notifications.filter(n=>!n.read).length;
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose}/>
      <div className="absolute right-0 top-full mt-1 w-80 bg-white border border-gray-200 shadow-2xl rounded-lg z-50 flex flex-col overflow-hidden" style={{maxHeight:"calc(100vh - 80px)"}}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold text-gray-900">Notifications</span>
            {unread>0&&<span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full text-white" style={{background:"#f59e0b"}}>{unread}</span>}
          </div>
          <div className="flex items-center gap-2">
            {unread>0&&<button onClick={onMarkAllRead} className="text-[11px] text-[#1e3a7b] hover:underline font-medium">Mark all read</button>}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close"><X size={15}/></button>
          </div>
        </div>
        <div className="overflow-y-auto flex-1" style={{scrollbarWidth:"none"}}>
          {notifications.length===0&&<EmptyState title="All caught up" body="No notifications at this time."/>}
          {notifications.map(n=>(
            <div key={n.id} className={`px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer ${!n.read?"bg-blue-50/40":""}`}>
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 shrink-0 w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center">{iconMap[n.type]??<Bell size={13}/>}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5"><span className="text-[12px] font-semibold text-gray-800">{n.title}</span>{!n.read&&<span className="w-1.5 h-1.5 rounded-full shrink-0" style={{background:"#2563eb"}}/>}</div>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{n.body}</p>
                  <div className="text-[10px] text-gray-400 font-mono mt-1">{n.time}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="p-3 border-t border-gray-100"><button className="w-full text-[12px] text-[#1e3a7b] font-medium hover:underline">View all notifications →</button></div>
      </div>
    </>
  );
}

// ─── Create Project Modal ─────────────────────────────────────────────────────

function CreateProjectModal({onClose,onSave}:{onClose:()=>void;onSave:()=>void}) {
  const [step,setStep]=useState(1);
  const [form,setForm]=useState({name:"",type:"Flood Control Wall",municipality:"Malolos",description:"",lat:"14.843",lng:"120.811",fundingSource:"GAA 2025 — DPWH Infra Fund",budget:"",startDate:"",endDate:"",contractor:"",districtOffice:"Bulacan 1st DEO"});
  const [errors,setErrors]=useState<Record<string,string>>({});
  const set=(k:string,v:string)=>{setForm(p=>({...p,[k]:v}));setErrors(p=>({...p,[k]:""}));};

  const validate=()=>{
    const e:Record<string,string>={};
    if(step===1&&!form.name.trim()) e.name="Project name is required";
    if(step===3&&!form.budget)      e.budget="Contract amount is required";
    if(step===3&&!form.startDate)   e.startDate="Start date is required";
    if(step===4&&!form.contractor)  e.contractor="Contractor selection is required";
    setErrors(e);
    return Object.keys(e).length===0;
  };

  const next=()=>{ if(validate()) setStep(s=>s+1); };
  const save=()=>{ if(!validate()) return; onSave(); toast.success("Project created — BCF-2025-019"); onClose(); };

  const steps=[{n:1,l:"Basic Info"},{n:2,l:"Location"},{n:3,l:"Financial"},{n:4,l:"Contractor"}];
  const projectTypes=["Flood Control Wall","River Dredging","Floodway Expansion","Retention Basin","Flood Gate System","Drainage Network","Tidal Barrier","Embankment Strengthening","Diversion Channel","LiDAR Survey"];
  const fundingSources=["GAA 2025 — DPWH Infra Fund","GAA 2025 — Flood Mitigation","NDRRMF 2025","ODA — JICA","ODA — ADB","ODA — World Bank","Pending — TBD"];
  const municipalities=["Angat","Balagtas","Baliuag","Bocaue","Bustos","Calumpit","Guiguinto","Hagonoy","Malolos","Marilao","Meycauayan","Norzagaray","Obando","Paombong","Pandi","Plaridel","Pulilan","San Jose del Monte","San Miguel","Sta. Maria"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{background:"rgba(13,31,60,0.5)"}} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-xl flex flex-col overflow-hidden" style={{maxHeight:"90vh"}}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div><h3 id="modal-title" className="text-[15px] font-bold text-gray-900">Create New Project</h3><p className="text-[12px] text-gray-400">Step {step} of 4 — {steps[step-1].l}</p></div>
          <button onClick={onClose} aria-label="Close dialog" className="text-gray-400 hover:text-gray-600"><X size={18}/></button>
        </div>
        <div className="flex border-b border-gray-100 shrink-0">
          {steps.map(s=>(
            <div key={s.n} className={`flex-1 py-2.5 text-center text-[11px] font-semibold transition-colors border-b-2 ${step===s.n?"border-[#1e3a7b] text-[#1e3a7b]":step>s.n?"border-green-400 text-green-600":"border-transparent text-gray-400"}`}>
              <span className={`inline-flex w-5 h-5 rounded-full items-center justify-center text-[10px] mr-1.5 ${step===s.n?"bg-[#1e3a7b] text-white":step>s.n?"bg-green-500 text-white":"bg-gray-200 text-gray-500"}`}>{step>s.n?<Check size={10}/>:s.n}</span>{s.l}
            </div>
          ))}
        </div>
        <div className="flex-1 overflow-auto p-6 space-y-4" style={{scrollbarWidth:"none"}}>
          {step===1&&<>
            <div><label htmlFor="proj-name" className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Project Name <span className="text-red-400">*</span></label><input id="proj-name" value={form.name} onChange={e=>set("name",e.target.value)} placeholder="e.g. Angat River Flood Control Wall Phase IV" className={`w-full px-3 py-2 text-sm border rounded focus:outline-none focus:border-[#1e3a7b] ${errors.name?"border-red-400":"border-gray-200"}`}/>{errors.name&&<p className="text-[11px] text-red-500 mt-1">{errors.name}</p>}</div>
            <div><label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Project Type</label><select value={form.type} onChange={e=>set("type",e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:border-[#1e3a7b]">{projectTypes.map(t=><option key={t}>{t}</option>)}</select></div>
            <div><label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">District Engineering Office</label><select value={form.districtOffice} onChange={e=>set("districtOffice",e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:border-[#1e3a7b]">{["Bulacan 1st DEO","Bulacan 2nd DEO","Bulacan 3rd DEO"].map(d=><option key={d}>{d}</option>)}</select></div>
            <div><label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Description</label><textarea value={form.description} onChange={e=>set("description",e.target.value)} rows={3} placeholder="Brief scope of work…" className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:border-[#1e3a7b] resize-none"/></div>
          </>}
          {step===2&&<>
            <div><label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Municipality <span className="text-red-400">*</span></label><select value={form.municipality} onChange={e=>set("municipality",e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:border-[#1e3a7b]">{municipalities.map(m=><option key={m}>{m}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Latitude</label><input value={form.lat} onChange={e=>set("lat",e.target.value)} placeholder="14.8430" className="w-full px-3 py-2 text-sm border border-gray-200 rounded font-mono focus:outline-none focus:border-[#1e3a7b]"/></div>
              <div><label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Longitude</label><input value={form.lng} onChange={e=>set("lng",e.target.value)} placeholder="120.8110" className="w-full px-3 py-2 text-sm border border-gray-200 rounded font-mono focus:outline-none focus:border-[#1e3a7b]"/></div>
            </div>
          </>}
          {step===3&&<>
            <div><label htmlFor="budget" className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Contract Amount (₱) <span className="text-red-400">*</span></label><input id="budget" value={form.budget} onChange={e=>set("budget",e.target.value)} type="number" placeholder="45000000" className={`w-full px-3 py-2 text-sm border rounded font-mono focus:outline-none focus:border-[#1e3a7b] ${errors.budget?"border-red-400":"border-gray-200"}`}/>{errors.budget&&<p className="text-[11px] text-red-500 mt-1">{errors.budget}</p>}{form.budget&&<div className="text-[11px] text-gray-400 mt-1">{pesoFull(parseFloat(form.budget)||0)}</div>}</div>
            <div><label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Funding Source</label><select value={form.fundingSource} onChange={e=>set("fundingSource",e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded bg-white focus:outline-none focus:border-[#1e3a7b]">{fundingSources.map(f=><option key={f}>{f}</option>)}</select></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label htmlFor="start" className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Start Date (NTP) <span className="text-red-400">*</span></label><input id="start" value={form.startDate} onChange={e=>set("startDate",e.target.value)} type="date" className={`w-full px-3 py-2 text-sm border rounded focus:outline-none focus:border-[#1e3a7b] ${errors.startDate?"border-red-400":"border-gray-200"}`}/>{errors.startDate&&<p className="text-[11px] text-red-500 mt-1">{errors.startDate}</p>}</div>
              <div><label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Target End Date</label><input value={form.endDate} onChange={e=>set("endDate",e.target.value)} type="date" className="w-full px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:border-[#1e3a7b]"/></div>
            </div>
          </>}
          {step===4&&<>
            <div><label htmlFor="contractor-sel" className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Awarded Contractor <span className="text-red-400">*</span></label><select id="contractor-sel" value={form.contractor} onChange={e=>set("contractor",e.target.value)} className={`w-full px-3 py-2 text-sm border rounded bg-white focus:outline-none focus:border-[#1e3a7b] ${errors.contractor?"border-red-400":"border-gray-200"}`}><option value="">— Select contractor —</option>{CONTRACTORS.map(c=><option key={c.id} value={c.name}>{c.name} — {c.totalProjects} contract{c.totalProjects===1?"":"s"}</option>)}</select>{errors.contractor&&<p className="text-[11px] text-red-500 mt-1">{errors.contractor}</p>}</div>
            {form.contractor&&(()=>{const c=CONTRACTORS.find(x=>x.name===form.contractor);if(!c)return null;const risky=c.flagRate>=0.25;return(<div className={`p-3 rounded border text-[12px] ${risky?"border-amber-200 bg-amber-50":"border-gray-200 bg-gray-50"}`}><div className="flex items-center gap-2 mb-2">{risky?<AlertTriangle size={13} className="text-amber-500"/>:<CheckCircle size={13} className="text-gray-400"/>}<span className={`font-semibold ${risky?"text-amber-700":"text-gray-600"}`}>{c.flaggedProjects} of {c.totalProjects} records flagged</span></div><div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-600"><span>Total awarded: <span className="font-mono">{peso(c.totalValue)}</span></span><span>Ongoing: {c.activeProjects}</span><span>Municipalities: {c.municipalities.length}</span><span>Years: <span className="font-mono">{c.years.length?`${c.years[0]}–${c.years[c.years.length-1]}`:"—"}</span></span></div></div>);})()}
          </>}
        </div>
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50">
          <button onClick={()=>step>1?setStep(s=>s-1):onClose()} className="px-4 py-2 text-sm border border-gray-200 rounded text-gray-600 hover:bg-white">{step===1?"Cancel":"← Back"}</button>
          <button onClick={step<4?next:save} className="px-5 py-2 text-sm font-semibold text-white rounded hover:opacity-90" style={{background:"#1e3a7b"}}>{step<4?"Continue →":"Create Project"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Top Nav ──────────────────────────────────────────────────────────────────

function TopNav({screen,onNavigate,onToggleSidebar,onToggleNotifications,unreadCount,role,onLogout,onCreateProject,canCreate,onOpenPalette}:{
  screen:Screen;onNavigate:(s:Screen)=>void;onToggleSidebar:()=>void;onToggleNotifications:()=>void;
  unreadCount:number;role:Role;onLogout:()=>void;onCreateProject:()=>void;canCreate:boolean;onOpenPalette:()=>void;
}) {
  const rc=ROLE_CFG[role];
  const links:[string,Screen,React.ReactNode,Role[]|null][]=[
    ["Dashboard","dashboard",<BarChart2 size={13}/>,null],
    ["Map","map",<MapIcon size={13}/>,null],
    ["Satellite","satellite",<Satellite size={13}/>,null],
    ["Documents","documents",<FileText size={13}/>,null],
    ["Reports","citizen-report",<Camera size={13}/>,null],
    ["Contractors","contractors",<Building2 size={13}/>,["dpwh-admin","dpwh-engineer"]],
    ["Admin","admin",<Settings size={13}/>,["dpwh-admin"]],
    ["Public","transparency",<Globe size={13}/>,null],
  ];
  const visible=links.filter(([,,, roles])=>!roles||roles.includes(role));
  return (
    <header className="h-[52px] shrink-0 flex items-center gap-2 px-3 border-b border-white/10" style={{background:"#1e3a7b"}}>
      <button onClick={onToggleSidebar} aria-label="Toggle sidebar" className="w-7 h-7 flex items-center justify-center rounded text-white/50 hover:text-white hover:bg-white/10 transition-colors"><Menu size={16}/></button>
      <div className="flex items-center gap-2 mr-2 shrink-0">
        <div className="w-7 h-7 rounded flex items-center justify-center" style={{background:"#f59e0b"}}><Shield size={14} style={{color:"#1e3a7b"}}/></div>
        <div className="leading-none"><div className="text-white font-bold text-sm tracking-widest">MASID</div><div className="text-white/40 tracking-wider" style={{fontSize:8}}>FLOOD CONTROL PH</div></div>
      </div>
      <nav className="flex items-center gap-0.5 overflow-x-auto" style={{scrollbarWidth:"none"}}>
        {visible.map(([label,s,icon])=>(
          <button key={s} onClick={()=>onNavigate(s)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[12px] font-medium transition-colors whitespace-nowrap shrink-0 ${screen===s?"bg-white/15 text-white":"text-white/55 hover:text-white hover:bg-white/8"}`}>
            {icon}{label}
          </button>
        ))}
      </nav>
      <div className="flex-1"/>
      <button onClick={onOpenPalette} title="Command Palette (⌘K)"
        className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded text-[12px] text-white/50 hover:text-white border border-white/15 hover:border-white/30 transition-colors shrink-0">
        <Command size={12}/><span>Search</span><kbd className="font-mono text-[10px] ml-1 opacity-60">⌘K</kbd>
      </button>
      {canCreate&&(
        <button onClick={onCreateProject}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-semibold shrink-0 transition-opacity hover:opacity-90"
          style={{background:"#f59e0b",color:"#1e3a7b"}}>
          <Plus size={13}/>New Project
        </button>
      )}
      <button onClick={onToggleNotifications} aria-label={`Notifications${unreadCount>0?`, ${unreadCount} unread`:""}`}
        className="relative w-8 h-8 flex items-center justify-center text-white/55 hover:text-white transition-colors shrink-0">
        <Bell size={17}/>
        {unreadCount>0&&<span className="absolute top-1 right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center border-2 border-[#1e3a7b]" style={{background:"#f59e0b",color:"#1e3a7b"}}>{unreadCount}</span>}
      </button>
      <div className="flex items-center gap-2 pl-2 border-l border-white/15 shrink-0">
        <div className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center" aria-hidden="true"><User size={14} className="text-white/80"/></div>
        <div className="text-[11px] leading-tight hidden sm:block">
          <div className="text-white font-semibold">A. Reyes</div>
          <span className="text-[9px] px-1.5 py-0.5 rounded font-medium text-white" style={{background:rc.bg}}>{rc.label}</span>
        </div>
        <button onClick={onLogout} title="Sign out" className="ml-1 text-white/40 hover:text-white transition-colors"><LogOut size={14}/></button>
      </div>
    </header>
  );
}

// ─── Left Sidebar ─────────────────────────────────────────────────────────────

// LeftSidebar was replaced by FilterPanel (src/app/FilterPanel.tsx): five status
// checkboxes and a single-handle budget slider, versus faceted multi-select with
// live counts, data-derived ranges and shareable URL state.

// ─── Dashboard Screen ─────────────────────────────────────────────────────────

function DashboardScreen({onNavigate,onViewDetail}:{onNavigate:(s:Screen)=>void;onViewDetail:(id:string)=>void}) {
  const totalBudget=META.coverage.totalBudget;
  const flagged=PROJECTS.filter(p=>p.auditFlags.length);
  const highSeverity=PROJECTS.filter(p=>p.auditFlags.some(f=>f.severity==="high"));
  const atRisk=[...flagged].sort((a,b)=>b.auditScore-a.auditScore||b.budget-a.budget);
  const withCoords=META.coverage.withCoordinates;
  const avgCompletion=PROJECTS.reduce((s,p)=>s+p.completion,0)/PROJECTS.length;
  const pct=(n:number)=>`${Math.round(n/PROJECTS.length*100)}%`;
  // Every figure below is counted from the loaded records. Where the public
  // record has no number — disbursement above all — none is shown.
  const kpis=[
    {l:"Flood Control Projects",  v:PROJECTS.length.toLocaleString(),  s:`${META.areaOfInterest}, ${META.coverage.yearMin}–${META.coverage.yearMax}`, trend:`${META.coverage.contractors} contractors`, up:true,  c:"#1e3a7b"},
    {l:"Contract Value",          v:peso(totalBudget),                 s:"Awarded amount; disbursement not published", trend:`${peso(FLAGGED_VALUE)} flagged`, up:false, c:"#16a34a"},
    {l:"Flagged for Review",      v:String(flagged.length),            s:`${pct(flagged.length)} of all records`, trend:`${highSeverity.length} high severity`, up:false, c:"#f59e0b"},
    {l:"Coordinates Published",   v:pct(withCoords),                   s:`${withCoords.toLocaleString()} of ${PROJECTS.length.toLocaleString()} locatable`, trend:`${PROJECTS.length-withCoords} without`, up:false, c:"#2563eb"},
    {l:"Reported Completion",     v:`${avgCompletion.toFixed(1)}%`,    s:"Mean DPWH-reported progress", trend:`${PROJECTS.filter(p=>p.dpwhStatus==="Completed").length} marked complete`, up:true, c:"#7c3aed"},
    {l:"Imagery Assessed",        v:SATELLITE.coverage.assessed.toLocaleString(), s:`Sentinel-2 10 m · ${SATELLITE.coverage.assessable.toLocaleString()} assessable`, trend:VALIDATION.discriminates?"validated against controls":"no discriminative power", up:false, c:VALIDATION.discriminates?"#0f766e":"#b91c1c"},
  ];
  const NAVY="#1e3a7b",GREEN="#16a34a",AMBER="#f59e0b",GRAY="#94a3b8";
  return (
    <div className="flex-1 overflow-auto bg-gray-50" style={{scrollbarWidth:"none"}}>
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div><h1 className="text-lg font-bold text-gray-900">Executive Dashboard</h1><p className="text-[13px] text-gray-500">{META.areaOfInterest} · DPWH Region III · {META.coverage.projects.toLocaleString()} flood control records, {META.coverage.yearMin}–{META.coverage.yearMax} · dataset built {META.generated.slice(0,10)}</p></div>
          <div className="flex items-center gap-2">
            <button onClick={()=>toast.success("Exporting PDF report…")} className="flex items-center gap-1.5 px-3 py-2 text-[13px] border border-gray-200 rounded text-gray-600 hover:bg-gray-50"><Download size={13}/>Export PDF</button>
            <button onClick={()=>onNavigate("map")} className="flex items-center gap-1.5 px-3 py-2 text-[13px] text-white rounded hover:opacity-90" style={{background:"#1e3a7b"}}><MapIcon size={13}/>Open Map</button>
          </div>
        </div>
      </div>
      <div className="p-6 space-y-5 max-w-7xl mx-auto">
        <div className="grid grid-cols-6 gap-3">
          {kpis.map(k=>(
            <div key={k.l} className="bg-white rounded border border-gray-200 p-4">
              <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">{k.l}</div>
              <div className="font-mono font-bold text-2xl mb-1" style={{color:k.c}}>{k.v}</div>
              <div className="text-[11px] text-gray-500 mb-2">{k.s}</div>
              <div className={`flex items-center gap-1 text-[11px] font-medium ${k.up?"text-green-600":"text-red-500"}`}>
                {k.up?<TrendingUp size={11}/>:<TrendingDown size={11}/>}{k.trend}
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2 bg-white rounded border border-gray-200 p-4">
            <div className="text-[12px] font-bold text-gray-700 mb-4">Projects by Municipality</div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={MUNI_BREAKDOWN} layout="vertical" margin={{top:0,right:16,bottom:0,left:78}}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9"/>
                <XAxis type="number" tick={{fontSize:10,fill:"#94a3b8"}} tickLine={false} axisLine={false}/>
                <YAxis dataKey="name" type="category" tick={{fontSize:9,fill:"#64748b"}} tickLine={false} axisLine={false} width={78} interval={0}/>
                <Tooltip contentStyle={{fontSize:11,borderRadius:6,border:"1px solid #e2e8f0"}}/>
                <Bar dataKey="completed"  name="Completed"  stackId="a" fill={GREEN}/>
                <Bar dataKey="ongoing"    name="Ongoing"    stackId="a" fill={NAVY}/>
                <Bar dataKey="flagged"    name="Flagged"    stackId="a" fill={AMBER}/>
                <Bar dataKey="proposed"   name="Proposed"   stackId="a" fill={GRAY}/>
                <Bar dataKey="terminated" name="Terminated" stackId="a" fill="#dc2626" radius={[0,2,2,0]}/>
                <Legend iconType="square" iconSize={8} wrapperStyle={{fontSize:11}}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded border border-gray-200 p-4 flex flex-col">
            <div className="text-[12px] font-bold text-gray-700 mb-2">Status Distribution</div>
            <div className="flex-1 flex flex-col items-center justify-center">
              <ResponsiveContainer width="100%" height={160}>
                <PieChart><Pie data={STATUS_PIE} cx="50%" cy="50%" innerRadius={48} outerRadius={72} dataKey="value" paddingAngle={2}>{STATUS_PIE.map((e,i)=><Cell key={i} fill={e.color}/>)}</Pie><Tooltip contentStyle={{fontSize:11,borderRadius:6}}/></PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-1 w-full">
                {STATUS_PIE.map(e=><div key={e.name} className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full shrink-0" style={{background:e.color}}/><span className="text-[11px] text-gray-600">{e.name}</span><span className="font-mono font-bold text-[11px] ml-auto" style={{color:e.color}}>{e.value}</span></div>)}
              </div>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded border border-gray-200 p-4">
            <div className="text-[12px] font-bold text-gray-700">Contract Value Awarded by Year (₱M)</div>
            <div className="text-[11px] text-gray-400 mb-3">Disbursement is not published by the transparency portal, so no spend series is shown.</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={BUDGET_BY_YEAR} margin={{top:0,right:8,bottom:0,left:8}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9"/><XAxis dataKey="year" tick={{fontSize:9,fill:"#94a3b8"}} tickLine={false} axisLine={false}/><YAxis tick={{fontSize:9,fill:"#94a3b8"}} tickLine={false} axisLine={false}/>
                <Tooltip contentStyle={{fontSize:11,borderRadius:6}} formatter={(v:number)=>`₱${v.toLocaleString()}M`}/><Legend iconType="square" iconSize={8} wrapperStyle={{fontSize:11}}/>
                <Bar dataKey="clean"   name="No flags"     stackId="v" fill={NAVY}/>
                <Bar dataKey="flagged" name="Flagged"      stackId="v" fill={AMBER} radius={[2,2,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-white rounded border border-gray-200 p-4">
            <div className="text-[12px] font-bold text-gray-700">Records by Consistency Check</div>
            <div className="text-[11px] text-gray-400 mb-3">Checks on published records only — not observations of the ground.</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={FLAG_BREAKDOWN} layout="vertical" margin={{top:0,right:24,bottom:0,left:120}}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9"/>
                <XAxis type="number" tick={{fontSize:10,fill:"#94a3b8"}} tickLine={false} axisLine={false}/>
                <YAxis dataKey="label" type="category" tick={{fontSize:9,fill:"#64748b"}} tickLine={false} axisLine={false} width={120}/>
                <Tooltip contentStyle={{fontSize:11,borderRadius:6}}/>
                <Bar dataKey="count" name="Records" fill={AMBER} radius={[0,2,2,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        {/* The 2x2 the fusion exists to produce. Two independent signals — the
            contract record disagreeing with itself, and the award sitting with a
            heavily concentrated contractor — measured to correlate at r = -0.12,
            so "both" is genuinely narrower than either list on its own. */}
        <div className="bg-white rounded border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2 flex-wrap">
            <Layers size={14} className="text-[#1e3a7b]"/>
            <span className="text-[12px] font-bold text-gray-700">Audit-Priority Triage</span>
            <span className="text-[11px] text-gray-400">· contract record × bidding red flags · this office awards at exactly 96.00% of the approved budget on {(PROCUREMENT.office.at96Rate*100).toFixed(1)}% of contracts, rank {PROCUREMENT.office.deoRankAt96} of {PROCUREMENT.office.deosCompared} DEOs (national {(PROCUREMENT.nationalBaseline.at96Rate*100).toFixed(1)}%)</span>
          </div>
          <div className="grid grid-cols-4 divide-x divide-gray-100">
            {(["both","records-only","procurement-only","neither"] as const).map(q=>{
              const c=QUADRANT_CFG[q];
              return (
                <div key={q} className="p-4" title={c.note}>
                  <div className="font-mono text-2xl font-bold" style={{color:c.color}}>{TRIAGE.counts[q].toLocaleString()}</div>
                  <div className="text-[11px] font-semibold text-gray-600 mt-0.5">{c.label}</div>
                  <div className="text-[10px] text-gray-400 mt-1">{peso(TRIAGE.value[q])}</div>
                </div>
              );
            })}
          </div>
          {PRIORITY.length>0&&(
            <>
              <div className="px-5 py-2.5 border-t border-gray-100 bg-red-50/40 text-[11px] text-gray-600">
                <strong className="text-red-700">Investigate first —</strong> both signals, highest value first.
                An ordering, not a prediction: there is no public itemised list of confirmed
                ghost projects to validate a ranking against.
              </div>
              <table className="w-full text-[12px]">
                <thead><tr className="border-b border-gray-100 bg-gray-50">{["Contract","Municipality","Contractor","Value","Signals","Action"].map(h=><th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{h}</th>)}</tr></thead>
                <tbody>
                  {PRIORITY.slice(0,8).map(f=>{
                    const p=PROJECTS.find(x=>x.id===f.id)!;
                    const pr=PROC_BY_ID.get(f.id);
                    const codes=[...p.auditFlags.map(x=>FLAG_LABELS[x.code]??x.code),
                                 ...(pr?.procurementFlags??[]).map(x=>PROC_FLAG_LABELS[x.code]??x.code)];
                    return (
                      <tr key={f.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3"><div className="font-mono text-[11px] text-gray-500">{f.id}</div><div className="text-gray-800 text-[11px]">{p.name.slice(0,40)}…</div></td>
                        <td className="px-4 py-3 text-gray-600">{p.municipality}</td>
                        <td className="px-4 py-3 text-gray-600 text-[11px]">{p.contractor.replace(/\s*\(.*$/,"").slice(0,30)}</td>
                        <td className="px-4 py-3 font-mono">{peso(p.budget)}</td>
                        <td className="px-4 py-3"><div className="flex gap-1 flex-wrap">{codes.slice(0,3).map(c=><span key={c} className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-700">{c}</span>)}</div></td>
                        <td className="px-4 py-3"><button onClick={()=>onViewDetail(f.id)} className="text-[#1e3a7b] text-[11px] font-medium flex items-center gap-1 hover:underline">Review<ArrowRight size={10}/></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </div>

        <div className="bg-white rounded border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
            <AlertCircle size={14} className="text-amber-500"/>
            <span className="text-[12px] font-bold text-gray-700">At-Risk &amp; Flagged Projects</span>
            <span className="text-[11px] font-mono bg-amber-50 text-amber-700 px-2 py-0.5 rounded ml-1">{atRisk.length}</span>
          </div>
          {atRisk.length===0?<EmptyState title="No at-risk projects" body="All active projects are progressing on schedule."/>:(
            <table className="w-full text-[12px]">
              <thead><tr className="border-b border-gray-100 bg-gray-50">{["Project","Municipality","Contractor","Completion","Status","Imagery","Action"].map(h=><th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{h}</th>)}</tr></thead>
              <tbody>
                {atRisk.map(p=>(
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3"><div className="font-medium text-gray-800">{p.name.slice(0,42)}{p.name.length>42?"…":""}</div><div className="text-[10px] font-mono text-gray-400">{p.id}</div></td>
                    <td className="px-4 py-3 text-gray-600">{p.municipality}</td>
                    <td className="px-4 py-3 text-gray-600">{p.contractor}</td>
                    <td className="px-4 py-3"><div className="flex items-center gap-2"><div className="w-20 bg-gray-100 rounded-full h-1.5"><div className="h-1.5 rounded-full" style={{width:`${p.completion}%`,background:STATUS_CFG[p.status].dot}}/></div><span className="font-mono text-[11px] text-gray-600">{p.completion}%</span></div></td>
                    <td className="px-4 py-3"><StatusBadge status={p.status}/></td>
                    <td className="px-4 py-3">{(()=>{
                      const sat=SAT_BY_ID.get(p.id);
                      if(!sat) return <span className="text-[11px] text-gray-300">not assessed</span>;
                      const v=VERDICT_CFG[sat.verdict];
                      return <span className="text-[11px] px-2 py-0.5 rounded font-medium" style={{background:v.bg,color:v.color}} title={v.note}>{v.short}</span>;
                    })()}</td>
                    <td className="px-4 py-3"><button onClick={()=>onViewDetail(p.id)} className="text-[#1e3a7b] text-[11px] font-medium flex items-center gap-1 hover:underline">Review<ArrowRight size={10}/></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Map Screen ───────────────────────────────────────────────────────────────

function MapScreen({projects,onViewDetail,filters,onClearFilters}:{projects:Project[];onViewDetail:(id:string)=>void;filters:Filters;onClearFilters:()=>void}) {
  const [selectedId,setSelectedId]=useState("");
  const [viewMode,setViewMode]=useState<"map"|"list">("map");
  // Colour follows the filter unless the user overrides it: setting a delivery
  // filter and then having to pick "colour by delivery" separately is a step
  // that should not exist.
  const [colorOverride,setColorOverride]=useState<string|null>(null);
  const encKey=colorOverride??suggestEncoding(filters as never);
  const enc=ENCODING_BY_KEY.get(encKey)!;
  const legend=useMemo(()=>legendFor(enc,projects),[enc,projects]);
  const [q,setQ]=useState("");
  const sort=useSort<Project>();
  const flagged=projects.filter(p=>p.status==="flagged").length;
  const filtered=useMemo(()=>projects.filter(p=>!q||p.name.toLowerCase().includes(q.toLowerCase())||p.municipality.toLowerCase().includes(q.toLowerCase())),[projects,q]);
  const sorted=useMemo(()=>sort.apply(filtered),[filtered,sort.apply]);
  const pg=usePagination(filtered.length,8);

  const selected=projects.find(p=>p.id===selectedId)??null;
  const nActive=activeCount(filters);

  const SlidePanel=({project}:{project:Project})=>{
    const c=STATUS_CFG[project.status];
    return (
      <div className="absolute right-0 top-0 bottom-0 bg-white border-l border-gray-200 shadow-2xl flex flex-col z-10" style={{width:296}}>
        <div className="flex items-start gap-2 p-4 border-b border-gray-100">
          <div className="flex-1 min-w-0"><div className="text-[10px] font-mono text-gray-400 mb-1">{project.id}</div><h3 className="text-[13px] font-bold text-gray-900 leading-snug">{project.name}</h3></div>
          <button onClick={()=>setSelectedId("")} aria-label="Close panel" className="p-1 text-gray-400 hover:text-gray-600 rounded shrink-0"><X size={15}/></button>
        </div>
        <div className="h-28 relative" style={{background:"linear-gradient(135deg,#ccdce8,#dde6f0)"}}>
          <svg viewBox="0 0 296 112" className="w-full h-full absolute inset-0"><rect width={296} height={112} fill="#cddde8"/><polygon points="38,4 42,24 46,54 42,88 38,112 75,112 130,108 158,94 162,72 160,52 154,34 122,18 84,8 55,6" fill="#dde6f0" stroke="#1e3a7b" strokeWidth={0.8}/>{(()=>{const{x,y}=toXY(project.lng,project.lat);const nx=(x/MB.W)*296,ny=(y/MB.H)*112;return(<><circle cx={nx} cy={ny} r={9} fill={c.dot} opacity={0.15}/><circle cx={nx} cy={ny} r={4.5} fill={c.dot} stroke="white" strokeWidth={1.5}/></>);})()}</svg>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5" style={{scrollbarWidth:"none"}}>
          <div className="flex items-center gap-2 flex-wrap"><StatusBadge status={project.status}/>{project.status==="flagged"&&<span className="text-[11px] text-amber-600 flex items-center gap-1"><AlertTriangle size={11}/>Needs Review</span>}</div>
          <AuditFlags project={project} compact/>
          <div className="space-y-2.5">
            {[{icon:<Building2 size={12} className="text-gray-400"/>,l:"Contractor",v:project.contractor},{icon:<MapPin size={12} className="text-gray-400"/>,l:"Location",v:`${project.municipality}, Bulacan`},{icon:<Banknote size={12} className="text-gray-400"/>,l:"Budget",v:pesoFull(project.budget),m:true}].map(({icon,l,v,m})=>(
              <div key={l} className="flex items-start gap-2"><div className="mt-0.5 shrink-0">{icon}</div><div className="flex-1 min-w-0"><div className="text-[10px] text-gray-400">{l}</div><div className={`text-[12px] font-medium text-gray-800 ${m?"font-mono":""}`}>{v}</div></div></div>
            ))}
            <div><div className="flex items-center justify-between mb-1.5"><span className="text-[10px] text-gray-400 flex items-center gap-1"><Percent size={11}/>Completion</span><span className="text-[12px] font-mono font-bold" style={{color:c.dot}}>{project.completion}%</span></div><div className="w-full bg-gray-100 rounded-full h-1.5"><div className="h-1.5 rounded-full" style={{width:`${project.completion}%`,background:c.dot}}/></div></div>
          </div>
        </div>
        <div className="p-4 border-t border-gray-100">
          <button onClick={()=>onViewDetail(project.id)} className="w-full py-2.5 rounded text-[13px] font-semibold text-white flex items-center justify-center gap-2 hover:opacity-90 transition-opacity" style={{background:"#1e3a7b"}}>View Full Details<ArrowRight size={14}/></button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="h-auto min-h-[44px] bg-white border-b border-gray-200 flex flex-wrap items-center px-4 gap-3 py-2 shrink-0">
        <div className="flex items-center gap-3 text-[13px]">
          <span><span className="font-mono font-bold text-[#1e3a7b]">{filtered.length}</span><span className="text-gray-500"> projects</span></span>
          <span className="w-px h-4 bg-gray-200"/>
          <span className="flex items-center gap-1"><AlertTriangle size={13} className="text-amber-500"/><span className="font-mono font-bold text-amber-600">{flagged}</span><span className="text-gray-400">flagged</span></span>
          {/* Be explicit about what the canvas cannot show, rather than letting
              the marker count quietly disagree with the project count. */}
          <span className="w-px h-4 bg-gray-200"/>
          <span className="text-[11px] text-gray-400" title="Records with no published coordinate, plus coordinates falling outside the drawn extent">
            <span className="font-mono">{PROJECTS.length-META.coverage.withCoordinates+OFF_MAP.length}</span> not mappable
          </span>
        </div>
        {nActive>0&&(
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-gray-400">{nActive} filter{nActive===1?"":"s"} active</span>
            <button onClick={onClearFilters} className="text-[11px] text-[#1e3a7b] hover:underline">clear all</button>
          </div>
        )}
        <div className="flex-1"/>
        {viewMode==="list"&&<div className="relative shrink-0"><Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Filter…" aria-label="Filter projects" className="pl-7 pr-3 py-1.5 text-[12px] border border-gray-200 rounded bg-gray-50 w-48 focus:outline-none focus:border-[#1e3a7b]"/></div>}
        <div className="flex border border-gray-200 rounded overflow-hidden text-[12px] font-medium shrink-0">
          <button onClick={()=>setViewMode("map")} className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${viewMode==="map"?"bg-[#1e3a7b] text-white":"text-gray-500 hover:bg-gray-50"}`}><MapIcon size={13}/>Map</button>
          <button onClick={()=>setViewMode("list")} className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${viewMode==="list"?"bg-[#1e3a7b] text-white":"text-gray-500 hover:bg-gray-50"}`}><List size={13}/>List</button>
        </div>
      </div>

      {viewMode==="map"?(
        <div className="flex-1 relative overflow-hidden">
          <MapSVG projects={filtered} selectedId={selectedId} onSelect={setSelectedId} enc={enc}/>
          <div className="absolute left-3 bottom-8 flex flex-col gap-1">
            <button aria-label="Zoom in"  className="w-8 h-8 bg-white border border-gray-200 rounded shadow-sm flex items-center justify-center text-gray-500 hover:bg-gray-50"><ZoomIn  size={14}/></button>
            <button aria-label="Zoom out" className="w-8 h-8 bg-white border border-gray-200 rounded shadow-sm flex items-center justify-center text-gray-500 hover:bg-gray-50"><ZoomOut size={14}/></button>
          </div>
          <div className="absolute bottom-8 right-3 bg-white/95 border border-gray-200 rounded shadow-sm p-3 backdrop-blur-sm" style={{maxWidth:250}} role="group" aria-label="Map legend">
            <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Colour by</label>
            <select value={encKey} onChange={e=>setColorOverride(e.target.value)}
              className="w-full text-[12px] border border-gray-200 rounded px-2 py-1 bg-white mb-2 focus:outline-none focus:border-[#1e3a7b]">
              {ENCODINGS.map(o=><option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
            {/* Counts and words carry the meaning, not the colour on its own —
                the palette clears every CVD gate but sits below 3:1 against the
                basemap, and a labelled legend is the method's relief for that. */}
            <div className="space-y-1">
              {legend.map(b=>(
                <div key={b.key} className={`flex items-center gap-2 ${b.n===0?"opacity-40":""}`}>
                  <svg width={14} height={14} viewBox="-7 -7 14 14" className="shrink-0" aria-hidden>
                    <path d={markPath(b.shape,5)} fill={b.color} stroke={BASEMAP.surface} strokeWidth={1.5} strokeLinejoin="round"/>
                  </svg>
                  <span className="text-[11px] text-gray-600 flex-1 leading-tight">{b.label}</span>
                  <span className="text-[10px] font-mono text-gray-400 tabular-nums">{b.n.toLocaleString()}</span>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-2 leading-snug">{enc.note}</p>
            {colorOverride&&<button onClick={()=>setColorOverride(null)} className="text-[10px] text-[#1e3a7b] hover:underline mt-1">follow filter</button>}
          </div>
          {filtered.length===0&&(
            <div className="absolute inset-0 flex items-center justify-center bg-white/80">
              <EmptyState title="No projects match your filters" body="Try adjusting the status or municipality filters in the sidebar." action="Reset Filters" onAction={()=>(Object.keys(filters) as ProjectStatus[]).forEach(k=>!filters[k]&&onToggleStatus(k))}/>
            </div>
          )}
          {selected&&<SlidePanel project={selected}/>}
        </div>
      ):(
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto">
            {filtered.length===0?(
              <EmptyState title="No projects found" body={q?`No results for "${q}"`:"No projects match the current filters."} action={q?"Clear search":undefined} onAction={q?()=>setQ(""):undefined}/>
            ):(
              <table className="w-full text-[13px] border-collapse">
                <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
                  <tr>
                    <SortTh col={"name" as keyof Project}         label="Project"      sortKey={sort.sortKey as keyof Project|null} sortDir={sort.sortDir} onSort={sort.toggle as (k:keyof Project)=>void}/>
                    <SortTh col={"municipality" as keyof Project} label="Municipality" sortKey={sort.sortKey as keyof Project|null} sortDir={sort.sortDir} onSort={sort.toggle as (k:keyof Project)=>void}/>
                    <SortTh col={"contractor" as keyof Project}   label="Contractor"   sortKey={sort.sortKey as keyof Project|null} sortDir={sort.sortDir} onSort={sort.toggle as (k:keyof Project)=>void}/>
                    <SortTh col={"budget" as keyof Project}       label="Budget"       sortKey={sort.sortKey as keyof Project|null} sortDir={sort.sortDir} onSort={sort.toggle as (k:keyof Project)=>void}/>
                    <SortTh col={"completion" as keyof Project}   label="Progress"     sortKey={sort.sortKey as keyof Project|null} sortDir={sort.sortDir} onSort={sort.toggle as (k:keyof Project)=>void}/>
                    <SortTh col={"status" as keyof Project}       label="Status"       sortKey={sort.sortKey as keyof Project|null} sortDir={sort.sortDir} onSort={sort.toggle as (k:keyof Project)=>void}/>
                    <th className="px-4 py-2.5"/>
                  </tr>
                </thead>
                <tbody>
                  {pg.paginate(sorted).map(p=>(
                    <tr key={p.id} className="border-b border-gray-100 hover:bg-blue-50/30 transition-colors">
                      <td className="px-4 py-3"><div className="font-semibold text-gray-900">{p.name}</div><div className="text-[11px] font-mono text-gray-400">{p.id}</div></td>
                      <td className="px-4 py-3 text-gray-600">{p.municipality}</td>
                      <td className="px-4 py-3 text-gray-600">{p.contractor}</td>
                      <td className="px-4 py-3 font-mono font-semibold text-gray-800 whitespace-nowrap">{peso(p.budget)}</td>
                      <td className="px-4 py-3 min-w-[120px]"><div className="flex items-center gap-2"><div className="flex-1 bg-gray-100 rounded-full h-1.5"><div className="h-1.5 rounded-full" style={{width:`${p.completion}%`,background:STATUS_CFG[p.status].dot}}/></div><span className="font-mono text-[11px] text-gray-500 w-7 text-right">{p.completion}%</span></div></td>
                      <td className="px-4 py-3"><StatusBadge status={p.status}/></td>
                      <td className="px-4 py-3"><button onClick={()=>onViewDetail(p.id)} className="text-[#1e3a7b] text-[12px] flex items-center gap-1 hover:underline font-medium">View<ArrowRight size={11}/></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <Pagination page={pg.page} totalPages={Math.ceil(filtered.length/pg.pageSize)} setPage={pg.setPage} total={filtered.length} pageSize={pg.pageSize}/>
        </div>
      )}
    </div>
  );
}

// ─── Project Detail Screen ────────────────────────────────────────────────────

function ProjectDetailScreen({project,onBack,onOpenSatellite}:{project:Project;onBack:()=>void;onOpenSatellite:()=>void}) {
  const [tab,setTab]=useState<"documents"|"satellite"|"reports">("documents");
  const c=STATUS_CFG[project.status];
  // The transparency portal publishes no documents, no inspection records and
  // no geotagged photos. Rather than mint plausible filenames, these panels state
  // what is missing and which part of the data request would supply it.
  const citizenReports=project.reportCount;
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      <nav className="bg-white border-b border-gray-200 px-6 py-4 shrink-0" aria-label="breadcrumb">
        <div className="flex items-start gap-3">
          <button onClick={onBack} aria-label="Back to map" className="mt-1 p-1.5 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-100 shrink-0"><ChevronLeft size={17}/></button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-[12px] text-gray-400 mb-2 font-medium">
              <button onClick={onBack} className="hover:text-[#1e3a7b] hover:underline">Map</button>
              <ChevronRight size={12}/>
              <span className="text-gray-600">{project.id}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap mb-1.5"><span className="text-[11px] font-mono bg-gray-100 text-gray-500 px-2 py-0.5 rounded">{project.id}</span><StatusBadge status={project.status} size="md"/></div>
            <h1 className="text-xl font-bold text-gray-900 leading-tight">{project.name}</h1>
            <p className="text-[13px] text-gray-500 mt-0.5">{project.municipality}, Province of Bulacan · {project.districtOffice}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button className="flex items-center gap-1.5 px-3 py-2 text-[13px] border border-gray-200 rounded text-gray-600 hover:bg-gray-50"><Download size={13}/>Export</button>
            <button onClick={()=>toast.success("Edit mode enabled")} className="flex items-center gap-1.5 px-3 py-2 text-[13px] text-white rounded hover:opacity-90" style={{background:"#1e3a7b"}}><Edit2 size={13}/>Edit</button>
          </div>
        </div>
        {project.auditFlags.length>0&&<div className="ml-11 mt-3"><AuditFlags project={project}/></div>}
        {(()=>{
          const pr=PROC_BY_ID.get(project.id);
          if(!pr||!pr.procurementFlags.length) return null;
          return (
            <div className="ml-11 mt-3 space-y-2">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                <Banknote size={11}/>Procurement signal
                <span className="font-mono bg-gray-100 text-gray-500 px-1.5 rounded normal-case tracking-normal">{pr.matchConfidence} match</span>
              </div>
              {pr.procurementFlags.map(f=>{
                const sv=SEVERITY_CFG[f.severity];
                return (
                  <div key={f.code} className="rounded border p-2.5 text-[11px]" style={{background:sv.bg,borderColor:sv.color+"33",color:sv.color}}>
                    <div className="flex items-center gap-2 mb-1">
                      <Banknote size={11}/><span className="font-semibold">{PROC_FLAG_LABELS[f.code]??f.code}</span>
                      <span className="ml-auto font-mono text-[9px] uppercase tracking-wider opacity-70">{sv.label}</span>
                    </div>
                    <div className="text-gray-700 leading-relaxed">{f.detail}</div>
                  </div>
                );
              })}
              <p className="text-[10px] text-gray-400 leading-relaxed">
                From PhilGEPS award records, joined on contractor name and contract amount.
                PhilGEPS publishes no bidder counts, so single-bidder and bid-to-budget
                indicators are absent rather than estimated.
              </p>
            </div>
          );
        })()}
      </nav>
      <div className="flex-1 overflow-auto p-6" style={{scrollbarWidth:"none"}}>
        <div className="max-w-6xl mx-auto grid grid-cols-3 gap-5">
          <div className="space-y-4">
            <div className="bg-white rounded border border-gray-200 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50"><span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Project Information</span></div>
              <dl className="p-4 space-y-3.5">
                {[{l:"Contractor",v:project.contractor},{l:"Municipality",v:`${project.municipality}, Bulacan`},{l:"Funding Source",v:project.fundingSource}].map(({l,v})=>(<div key={l}><dt className="text-[10px] text-gray-400 mb-0.5 uppercase tracking-wider">{l}</dt><dd className="text-[13px] font-medium text-gray-800">{v}</dd></div>))}
                <div><dt className="text-[10px] text-gray-400 mb-0.5 uppercase tracking-wider">Contract Amount</dt><dd className="text-[17px] font-mono font-bold text-gray-900">{pesoFull(project.budget)}</dd></div>
                <div><div className="flex items-center justify-between mb-1.5"><span className="text-[10px] text-gray-400 uppercase tracking-wider">Completion</span><span className="text-[13px] font-mono font-bold" style={{color:c.dot}}>{project.completion}%</span></div><div className="w-full bg-gray-100 rounded-full h-2" role="progressbar" aria-valuenow={project.completion} aria-valuemin={0} aria-valuemax={100}><div className="h-2 rounded-full" style={{width:`${project.completion}%`,background:c.dot}}/></div></div>
                <div className="grid grid-cols-2 gap-3"><div><dt className="text-[10px] text-gray-400 mb-0.5 uppercase tracking-wider">Start (NTP)</dt><dd className="text-[12px] font-mono text-gray-700">{project.startDate??"—"}</dd></div><div><dt className="text-[10px] text-gray-400 mb-0.5 uppercase tracking-wider">Target End</dt><dd className="text-[12px] font-mono text-gray-700">{project.endDate??"—"}</dd></div></div>
              </dl>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded border border-gray-200 p-3"><div className="font-mono text-2xl font-bold text-gray-300">—</div><div className="text-[11px] text-gray-400 mt-0.5">Documents (not published)</div></div>
              <div className="bg-white rounded border border-gray-200 p-3"><div className="font-mono text-2xl font-bold" style={{color:citizenReports?"#1e3a7b":"#d1d5db"}}>{citizenReports||"—"}</div><div className="text-[11px] text-gray-400 mt-0.5">Citizen Reports</div></div>
            </div>
          </div>
          <div className="col-span-2 bg-white rounded border border-gray-200 flex flex-col overflow-hidden">
            <div className="flex border-b border-gray-200 shrink-0" role="tablist">
              {([["Documents","documents",<FileText size={13}/>],["Satellite Imagery","satellite",<Satellite size={13}/>],["Citizen Reports","reports",<MessageSquare size={13}/>]]as[string,typeof tab,React.ReactNode][]).map(([label,key,icon])=>(
                <button key={key} role="tab" aria-selected={tab===key} onClick={()=>setTab(key)}
                  className={`flex items-center gap-2 px-5 py-3 text-[13px] font-medium border-b-2 transition-colors ${tab===key?"border-[#1e3a7b] text-[#1e3a7b]":"border-transparent text-gray-500 hover:text-gray-700"}`}>
                  {icon}{label}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-auto p-5" role="tabpanel" style={{scrollbarWidth:"none"}}>
              {tab==="documents"&&(()=>{
                const pr=PROC_BY_ID.get(project.id);
                const have=pr?(Object.keys(DOC_LABELS) as (keyof typeof DOC_LABELS)[]).filter(k=>pr.documents[k]):[];
                if(!have.length) return (
                  <div className="max-w-xl">
                    <EmptyState title="No documents published for this contract" body="This contract is one of the few without a published document. Roughly 95% of contracts at this office do publish the invitation to bid, contract agreement, notice of award and notice to proceed."/>
                  </div>
                );
                return (
                  <div className="max-w-2xl space-y-2">
                    {have.map(k=>(
                      <a key={k} href={pr!.documents[k]!} target="_blank" rel="noreferrer"
                        className="flex items-center gap-3 p-3 border border-gray-100 rounded hover:border-[#1e3a7b]/30 hover:bg-blue-50/30 transition-colors">
                        <FileText size={17} style={{color:"#1e3a7b"}} className="shrink-0"/>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-medium text-gray-800">{DOC_LABELS[k]}</div>
                          <div className="text-[10px] font-mono text-gray-400 truncate">{pr!.documents[k]!.split("/").pop()}</div>
                        </div>
                        <ExternalLink size={13} className="text-gray-300 shrink-0"/>
                      </a>
                    ))}
                    <p className="text-[10px] text-gray-400 leading-relaxed pt-1">
                      Published by DPWH and served from dcs.infrawatch.ph. Program of work and
                      engineering design are not published for any contract at this office.
                    </p>
                  </div>
                );
              })()}
              {tab==="satellite"&&(()=>{
                const sat=SAT_BY_ID.get(project.id);
                if(!sat) return (
                  <div className="max-w-xl">
                    <EmptyState title="Not in the assessed subset" body={`The satellite tier runs on an audit-priority selection plus a seeded control sample — ${SATELLITE.coverage.assessed} of ${SATELLITE.coverage.total.toLocaleString()} records so far. Open Satellite Monitoring for how to extend it.`}/>
                  </div>
                );
                const cfg=VERDICT_CFG[sat.verdict];
                const r30=sat.rings.r30, r150=sat.rings.r150;
                return (
                  <div className="max-w-2xl space-y-4">
                    <div className="rounded border p-3.5" style={{background:cfg.bg,borderColor:cfg.color+"44"}}>
                      <div className="text-[12px] font-bold mb-1" style={{color:cfg.color}}>{cfg.label}</div>
                      <p className="text-[12px] text-gray-700 leading-relaxed">{sat.detail}</p>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        {l:"At 30 m",  v:r30?`${r30.zNdvi>=0?"+":""}${r30.zNdvi.toFixed(1)}σ / ${r30.zNdbi>=0?"+":""}${r30.zNdbi.toFixed(1)}σ`:"—"},
                        {l:"At 150 m", v:r150?`${r150.zNdvi>=0?"+":""}${r150.zNdvi.toFixed(1)}σ / ${r150.zNdbi>=0?"+":""}${r150.zNdbi.toFixed(1)}σ`:"—"},
                        {l:"Cloud-free", v:`${Math.round(sat.cloudFreeFraction*100)}%`},
                      ].map(({l,v})=>(
                        <div key={l} className="bg-gray-50 rounded p-3">
                          <div className="font-mono text-[13px] font-bold text-gray-800">{v}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">{l}</div>
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] text-gray-400 leading-relaxed">{cfg.note}</p>
                    <button onClick={onOpenSatellite} className="text-[13px] font-medium text-[#1e3a7b] flex items-center gap-1.5 hover:underline"><Satellite size={14}/>Open full assessment →</button>
                  </div>
                );
              })()}
              {tab==="reports"&&(
                <div className="max-w-xl">
                  {citizenReports>0
                    ? <div className="border border-gray-200 rounded p-4 text-[13px] text-gray-600">DPWH records <span className="font-mono font-bold text-[#1e3a7b]">{citizenReports}</span> citizen report{citizenReports===1?"":"s"} against this contract. The portal publishes the count but not the report contents.</div>
                    : <EmptyState title="No citizen reports recorded" body="DPWH records no citizen reports against this contract. Across all 1,293 records in this district only 4 carry any report at all, so absence here says more about reporting reach than about the project."/>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Satellite Screen ─────────────────────────────────────────────────────────

function SatelliteScreen({project}:{project:Project|null}) {
  const sat=project?SAT_BY_ID.get(project.id):undefined;
  const cfg=sat?VERDICT_CFG[sat.verdict]:null;
  const radii=[30,90,150];
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-3.5 shrink-0 flex items-center gap-3">
        <Satellite size={18} style={{color:"#1e3a7b"}}/>
        <div>
          <div className="text-[14px] font-bold text-gray-900">Satellite Monitoring</div>
          <div className="text-[12px] text-gray-500">{project?.name.slice(0,70)??"Select a project"} · Sentinel-2 L2A, 10 m · {SATELLITE.source.access}</div>
        </div>
        {cfg&&<span className="ml-auto text-[11px] font-semibold px-2.5 py-1 rounded" style={{background:cfg.bg,color:cfg.color}}>{cfg.short.toUpperCase()}</span>}
      </div>
      <div className="flex-1 overflow-auto p-6" style={{scrollbarWidth:"none"}}>
        <div className="max-w-4xl mx-auto space-y-4">

          {/* The control sample measured this method against itself. If it cannot
              separate flagged records from ordinary ones, that has to be the first
              thing anyone reads — before any individual verdict. */}
          <div className="rounded border p-4" style={VALIDATION.discriminates
            ? {background:"#f0fdf4",borderColor:"#86efac"}
            : {background:"#fef2f2",borderColor:"#fca5a5"}}>
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" style={{color:VALIDATION.discriminates?"#15803d":"#b91c1c"}}/>
              <div className="min-w-0">
                <div className="text-[12px] font-bold mb-1" style={{color:VALIDATION.discriminates?"#15803d":"#b91c1c"}}>
                  Method validation — {VALIDATION.discriminates?"detector separates flagged from control":"no measured discriminative power"}
                </div>
                <p className="text-[12px] text-gray-700 leading-relaxed">{VALIDATION.verdict}</p>
                <div className="flex gap-5 mt-2.5 text-[11px] font-mono text-gray-600 flex-wrap">
                  <span>flagged <strong>{VALIDATION.flagged.detections}/{VALIDATION.flagged.assessed}</strong> ({((VALIDATION.flagged.rate??0)*100).toFixed(1)}%)</span>
                  <span>seeded control <strong>{VALIDATION.control.detections}/{VALIDATION.control.assessed}</strong> ({((VALIDATION.control.rate??0)*100).toFixed(1)}%)</span>
                  <span>median σ at 30 m — flagged {VALIDATION.flagged.medianZNdvi30m}, control {VALIDATION.control.medianZNdvi30m}</span>
                </div>
              </div>
            </div>
          </div>

          {!project&&<EmptyState title="No project selected" body="Open a project from the map or list to see its imagery assessment."/>}

          {project&&!sat&&(
            <div className="bg-white rounded border border-gray-200 p-5">
              <div className="text-[14px] font-bold text-gray-800 mb-1">Not assessed</div>
              <p className="text-[13px] text-gray-500 leading-relaxed">
                This contract is not in the assessed subset. The satellite tier runs on an
                audit-priority selection — the highest-scoring flagged records plus a seeded
                control sample — so that flagged and unflagged records are measured the same
                way. {SATELLITE.coverage.assessed} of {SATELLITE.coverage.total.toLocaleString()} records
                have been assessed so far. Raise <code className="font-mono">--limit</code> on
                <code className="font-mono"> pipeline/satellite.py</code> to extend coverage;
                results cache, so only new records are fetched.
              </p>
            </div>
          )}

          {sat&&cfg&&(
            <>
              <div className="rounded border p-4" style={{background:cfg.bg,borderColor:cfg.color+"44"}}>
                <div className="flex items-start gap-2.5">
                  <Satellite size={15} className="shrink-0 mt-0.5" style={{color:cfg.color}}/>
                  <div>
                    <div className="text-[13px] font-bold mb-1" style={{color:cfg.color}}>{cfg.label}</div>
                    <p className="text-[12px] text-gray-700 leading-relaxed">{sat.detail}</p>
                    <p className="text-[11px] text-gray-500 leading-relaxed mt-2">{cfg.note}</p>
                  </div>
                </div>
              </div>

              {sat.chips&&(
                <div className="bg-white rounded border border-gray-200 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 flex items-center gap-3 flex-wrap">
                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">NDVI, before and after</span>
                    <span className="text-[11px] text-gray-400">· rings mark the 30 / 90 / 150 m sampling radii, cross marks the published coordinate</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 p-4">
                    {([["before","Before construction",sat.scenesBefore],["after","After completion",sat.scenesAfter]] as const).map(([k,label,scenes])=>(
                      <figure key={k} className="m-0">
                        <img src={sat.chips![k]} alt={`NDVI composite ${label.toLowerCase()} for ${project.id}`}
                          className="w-full rounded border border-gray-200" style={{imageRendering:"pixelated",aspectRatio:"1"}}/>
                        <figcaption className="mt-2">
                          <div className="text-[12px] font-semibold text-gray-700">{label}</div>
                          <div className="text-[10px] font-mono text-gray-400 truncate" title={scenes.join(", ")}>{scenes.length} scene{scenes.length===1?"":"s"} · median composite</div>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                  <div className="px-4 pb-3 flex items-center gap-3 flex-wrap text-[10px] text-gray-400">
                    <span className="flex items-center gap-1.5"><span className="inline-block w-8 h-2.5 rounded-sm" style={{background:"linear-gradient(90deg,#6e4a2e,#a68a6a,#ded8c6,#96be78,#40914a,#12522c)"}}/>bare ground → dense vegetation</span>
                    <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-2.5 rounded-sm" style={{background:"#8c8f94"}}/>cloud-masked, no clear observation</span>
                    <span>· 1 px = 10 m</span>
                  </div>
                </div>
              )}

              <div className="bg-white rounded border border-gray-200 p-4">
                <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Change by sampling radius</div>
                <p className="text-[11px] text-gray-400 mb-3 leading-relaxed">
                  Each figure is the local change from the pre-construction period to the
                  post-completion period, measured against a bootstrap null: {String(SATELLITE.method.nullSamples)} discs
                  of the same radius dropped at random in this site&apos;s own 300–600 m annulus.
                  &ldquo;Rank vs null&rdquo; is where the real disc falls among them. Construction reads
                  as NDVI down and NDBI up; both must pass {String(SATELLITE.method.ndviZThreshold)}σ / +{String(SATELLITE.method.ndbiZThreshold)}σ to count.
                </p>
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {["Radius","ΔNDVI","σ","ΔNDBI","σ","Rank vs null","Reads as"].map(h=>(
                        <th key={h} className="text-left py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {radii.map(r=>{
                      const v=sat.rings[`r${r}`];
                      if(!v) return (
                        <tr key={r} className="border-b border-gray-50">
                          <td className="py-2.5 font-mono">{r} m</td>
                          <td colSpan={6} className="py-2.5 text-gray-300">not enough clear pixels</td>
                        </tr>
                      );
                      const hit=v.zNdvi<=Number(SATELLITE.method.ndviZThreshold)&&v.zNdbi>=Number(SATELLITE.method.ndbiZThreshold);
                      return (
                        <tr key={r} className="border-b border-gray-50">
                          <td className="py-2.5 font-mono text-gray-700">{r} m</td>
                          <td className="py-2.5 font-mono" style={{color:v.dNdvi<0?"#15803d":"#64748b"}}>{v.dNdvi>=0?"+":""}{v.dNdvi.toFixed(3)}</td>
                          <td className="py-2.5 font-mono text-gray-500">{v.zNdvi>=0?"+":""}{v.zNdvi.toFixed(2)}</td>
                          <td className="py-2.5 font-mono" style={{color:v.dNdbi>0?"#b45309":"#64748b"}}>{v.dNdbi>=0?"+":""}{v.dNdbi.toFixed(3)}</td>
                          <td className="py-2.5 font-mono text-gray-500">{v.zNdbi>=0?"+":""}{v.zNdbi.toFixed(2)}</td>
                          <td className="py-2.5 font-mono text-gray-500" title="Share of randomly placed same-radius discs showing less NDVI change than this one">{(v.pctNdvi*100).toFixed(0)}th pct</td>
                          <td className="py-2.5">{hit
                            ?<span className="text-[11px] px-2 py-0.5 rounded font-medium bg-amber-50 text-amber-700">construction-consistent</span>
                            :<span className="text-[11px] text-gray-400">below threshold</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded border border-gray-200 p-4">
                  <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Assessment Quality</div>
                  <dl className="space-y-2.5">
                    {[
                      {l:"Confidence",v:sat.confidence},
                      {l:"Cloud-free fraction",v:`${Math.round(sat.cloudFreeFraction*100)}%`},
                      {l:"Null discs sampled",v:sat.control?String(sat.control.nullDiscs):"—"},
                      {l:"Method validated",v:VALIDATION.discriminates?"yes":"no — see banner"},
                    ].map(({l,v})=>(
                      <div key={l} className="flex items-center justify-between">
                        <dt className="text-[12px] text-gray-500">{l}</dt>
                        <dd className="text-[12px] font-mono font-medium text-gray-800">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <div className="bg-white rounded border border-gray-200 p-4">
                  <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Scenes Used</div>
                  <div className="space-y-2 text-[11px] font-mono text-gray-600">
                    <div><span className="text-gray-400 not-italic font-sans">Before · </span>{sat.scenesBefore.length?sat.scenesBefore.join(", "):"—"}</div>
                    <div><span className="text-gray-400 font-sans">After · </span>{sat.scenesAfter.length?sat.scenesAfter.join(", "):"—"}</div>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-3 leading-relaxed">
                    Copernicus Sentinel data (ESA), retrieved from AWS Open Data via Earth Search. No account required.
                  </p>
                </div>
              </div>
            </>
          )}

          <div className="text-[11px] text-gray-400 leading-relaxed border-t border-gray-100 pt-3">
            <strong className="text-gray-500">What this cannot do.</strong> Sentinel-2 resolves 10 m
            per pixel. A revetment two metres wide, a drainage line, a repair to an existing structure,
            or any work on ground that was already bare will produce no signal at all. A &ldquo;no signal&rdquo;
            result narrows where to look; it does not establish that nothing was built. Field inspection
            and sub-metre imagery remain the only ways to settle an individual case.
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Documents Screen ─────────────────────────────────────────────────────────

function DocumentsScreen() {
  // This screen previously stated that DPWH publishes no contract documents.
  // That was wrong: the claim came from reading the flat export, which drops the
  // link columns. 99.5% of contracts at this office carry at least one live
  // document URL, and a sampled dozen were confirmed to resolve.
  const [q,setQ]=useState("");
  const rows=useMemo(()=>PROCUREMENT.results
    .map(r=>({r, p:PROJECTS.find(x=>x.id===r.id)}))
    .filter(({r,p})=>p&&Object.values(r.documents).some(Boolean)&&
      (!q||r.id.toLowerCase().includes(q.toLowerCase())||p!.description.toLowerCase().includes(q.toLowerCase())))
  ,[q]);
  const pg=usePagination(rows.length,10);
  const counts=(Object.keys(DOC_LABELS) as (keyof typeof DOC_LABELS)[])
    .map(k=>({k,n:PROCUREMENT.results.filter(r=>r.documents[k]).length}));
  return (
    <div className="flex-1 overflow-auto bg-gray-50" style={{scrollbarWidth:"none"}}>
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Contract Documents</h1>
          <p className="text-[13px] text-gray-500">{PROCUREMENT.office.documentsPublished.toLocaleString()} of {PROJECTS.length.toLocaleString()} contracts publish at least one document · served by dcs.infrawatch.ph</p>
        </div>
        <div className="ml-auto relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"/>
          <input value={q} onChange={e=>{setQ(e.target.value);pg.setPage(1);}} placeholder="Search contract ID or description…" className="pl-7 pr-3 py-2 text-[12px] border border-gray-200 rounded bg-gray-50 w-72 focus:outline-none focus:border-[#1e3a7b]"/>
        </div>
      </div>
      <div className="p-6 space-y-4 max-w-6xl mx-auto">
        <div className="grid grid-cols-6 gap-3">
          {counts.map(({k,n})=>(
            <div key={k} className="bg-white rounded border border-gray-200 p-3">
              <div className="font-mono text-xl font-bold" style={{color:n?"#1e3a7b":"#cbd5e1"}}>{n.toLocaleString()}</div>
              <div className="text-[10px] text-gray-500 mt-0.5 leading-tight">{DOC_LABELS[k]}</div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-gray-400 leading-relaxed">
          Program of work and engineering design are empty on every contract at this office —
          those remain the genuine gap, and are sections 1C of the consolidated data request.
          The invitation-to-bid bundle is a .zip that typically contains the bill of quantities
          and plans.
        </p>
        <div className="bg-white rounded border border-gray-200 overflow-hidden">
          <table className="w-full text-[12px]">
            <thead><tr className="border-b border-gray-100 bg-gray-50">{["Contract","Description","Award","Documents"].map(h=><th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{h}</th>)}</tr></thead>
            <tbody>
              {pg.paginate(rows).map(({r,p})=>(
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 align-top">
                  <td className="px-4 py-3 font-mono text-[11px] text-gray-600">{r.id}</td>
                  <td className="px-4 py-3 text-gray-700 max-w-md">{p!.description.slice(0,95)}{p!.description.length>95?"…":""}</td>
                  <td className="px-4 py-3 font-mono whitespace-nowrap">{r.awardAmount?pesoFull(r.awardAmount):"—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {(Object.keys(DOC_LABELS) as (keyof typeof DOC_LABELS)[]).filter(k=>r.documents[k]).map(k=>(
                        <a key={k} href={r.documents[k]!} target="_blank" rel="noreferrer"
                          className="text-[10px] px-2 py-1 rounded border border-gray-200 text-[#1e3a7b] hover:bg-blue-50 hover:border-[#1e3a7b]/30 flex items-center gap-1">
                          <FileText size={10}/>{DOC_LABELS[k]}<ExternalLink size={9}/>
                        </a>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={pg.page} totalPages={Math.ceil(rows.length/pg.pageSize)} setPage={pg.setPage} total={rows.length} pageSize={pg.pageSize}/>
        </div>
      </div>
    </div>
  );
}

// ─── Admin Screen ─────────────────────────────────────────────────────────────

function AdminScreen() {
  const [tab,setTab]=useState<"users"|"audit"|"integrations">("users");
  const [confirm,setConfirm]=useState<{title:string;body:string;onConfirm:()=>void}|null>(null);
  const ROLE_LABELS:Record<Role,string>={"dpwh-admin":"DPWH Admin","dpwh-engineer":"DPWH Engineer","field-inspector":"Field Inspector","psa-analyst":"PSA Analyst","lgu-coordinator":"LGU Coordinator","public":"Public"};
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
      {confirm&&<ConfirmDialog {...confirm} danger onCancel={()=>setConfirm(null)}/>}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0 flex items-center gap-4">
        <Settings size={18} style={{color:"#1e3a7b"}}/>
        <div><div className="text-[14px] font-bold text-gray-900">System Administration</div><div className="text-[12px] text-gray-500">User management · Audit trail · Integration status</div></div>
        <div className="ml-auto flex items-center gap-3 border-l border-gray-100 pl-4">
          {[{l:String(PROJECTS.length),s:"Projects",bg:"#eef2f9",c:"#1e3a7b"},{l:String(SYSTEM_USERS.length),s:"Users",bg:"#f0fdf4",c:"#15803d"},{l:String(PROJECTS.filter(p=>p.status==="flagged").length),s:"Flagged",bg:"#fffbeb",c:"#b45309"},{l:"5/8",s:"Integrations",bg:"#eff6ff",c:"#1d4ed8"}].map(k=>(
            <div key={k.s} className="rounded px-3 py-1.5 text-center" style={{background:k.bg}}><div className="font-mono font-bold text-sm" style={{color:k.c}}>{k.l}</div><div className="text-[9px] text-gray-500">{k.s}</div></div>
          ))}
        </div>
      </div>
      <div className="flex border-b border-gray-200 bg-white px-6" role="tablist">
        {([["users","Users",<Users size={13}/>],["audit","Audit Log",<Activity size={13}/>],["integrations","Integrations",<Wifi size={13}/>]]as[typeof tab,string,React.ReactNode][]).map(([key,label,icon])=>(
          <button key={key} role="tab" aria-selected={tab===key} onClick={()=>setTab(key)}
            className={`flex items-center gap-2 px-4 py-3 text-[13px] font-medium border-b-2 transition-colors ${tab===key?"border-[#1e3a7b] text-[#1e3a7b]":"border-transparent text-gray-500 hover:text-gray-700"}`}>
            {icon}{label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-6" style={{scrollbarWidth:"none"}} role="tabpanel">
        {tab==="users"&&(
          <div className="bg-white rounded border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
              <span className="text-[13px] font-bold text-gray-800">System Users</span>
              <button onClick={()=>toast.success("Invite sent")} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-[13px] text-white rounded hover:opacity-90" style={{background:"#1e3a7b"}}><Plus size={13}/>Invite User</button>
            </div>
            <table className="w-full text-[13px]">
              <thead className="border-b border-gray-100 bg-gray-50"><tr>{["Name","Role","Email","Last Login","Status","Actions"].map(h=><th key={h} className="text-left px-5 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{h}</th>)}</tr></thead>
              <tbody>
                {SYSTEM_USERS.map((u,i)=>(
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3"><div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold text-white" style={{background:"#1e3a7b"}}>{u.name[0]}</div><span className="font-medium text-gray-800">{u.name}</span></div></td>
                    <td className="px-5 py-3"><span className="text-[11px] px-2 py-0.5 rounded font-medium text-white" style={{background:ROLE_CFG[u.role].bg}}>{ROLE_LABELS[u.role]}</span></td>
                    <td className="px-5 py-3 font-mono text-[12px] text-gray-600">{u.email}</td>
                    <td className="px-5 py-3 text-gray-500 text-[12px]">{u.lastLogin}</td>
                    <td className="px-5 py-3"><span className={`text-[11px] px-2 py-0.5 rounded font-medium capitalize ${u.status==="active"?"bg-green-50 text-green-700":u.status==="inactive"?"bg-gray-100 text-gray-500":"bg-red-50 text-red-700"}`}>{u.status}</span></td>
                    <td className="px-5 py-3"><div className="flex items-center gap-2">
                      <button onClick={()=>toast.success(`Editing ${u.name}`)} className="text-[12px] text-[#1e3a7b] hover:underline">Edit</button>
                      <span className="text-gray-200">·</span>
                      <button onClick={()=>setConfirm({title:`${u.status==="suspended"?"Restore":"Suspend"} ${u.name}?`,body:`This will ${u.status==="suspended"?"restore access for":"suspend"} ${u.name} (${u.email}).`,onConfirm:()=>toast.warning(`${u.name} ${u.status==="suspended"?"restored":"suspended"}`)})} className="text-[12px] text-red-500 hover:underline">{u.status==="suspended"?"Restore":"Suspend"}</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {tab==="audit"&&(
          <div className="bg-white rounded border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
              <span className="text-[13px] font-bold text-gray-800">Audit Trail</span>
              <button onClick={()=>toast.success("Audit log exported")} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-[13px] border border-gray-200 rounded text-gray-600 hover:bg-gray-50"><Download size={13}/>Export CSV</button>
            </div>
            <table className="w-full text-[12px]">
              <thead className="border-b border-gray-100 bg-gray-50"><tr>{["Timestamp","User","Action","Target","IP Address"].map(h=><th key={h} className="text-left px-5 py-3 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{h}</th>)}</tr></thead>
              <tbody>{AUDIT_LOG.map((e,i)=><tr key={i} className="border-b border-gray-50 hover:bg-gray-50"><td className="px-5 py-3 font-mono text-gray-500 whitespace-nowrap">{e.time}</td><td className="px-5 py-3 font-medium text-gray-700">{e.user}</td><td className="px-5 py-3 text-gray-600">{e.action}</td><td className="px-5 py-3 font-mono text-[11px] text-[#1e3a7b]">{e.target}</td><td className="px-5 py-3 font-mono text-gray-400">{e.ip}</td></tr>)}</tbody>
            </table>
          </div>
        )}
        {tab==="integrations"&&(
          <div className="grid grid-cols-2 gap-4">
            {INTEGRATIONS.map(s=>{const col=s.status==="live"?"#16a34a":s.status==="degraded"?"#f59e0b":"#dc2626";return(
              <div key={s.name} className="bg-white rounded border border-gray-200 p-4 flex items-center gap-4">
                <div className="text-2xl">{s.icon}</div>
                <div className="flex-1 min-w-0"><div className="text-[13px] font-semibold text-gray-800">{s.name}</div><div className="text-[11px] font-mono text-gray-400 mt-0.5">Last sync: {s.lastSync}</div></div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {s.status==="live"?<Wifi size={14} style={{color:col}}/>:<WifiOff size={14} style={{color:col}}/>}
                  <span className="text-[11px] font-semibold capitalize" style={{color:col}}>{s.status}</span>
                </div>
              </div>
            );})}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Transparency Screen ──────────────────────────────────────────────────────

function TransparencyScreen({onLogin}:{onLogin:()=>void}) {
  const [q,setQ]=useState("");
  const sort=useSort<Project>();
  const filtered=useMemo(()=>PROJECTS.filter(p=>!q||p.name.toLowerCase().includes(q.toLowerCase())||p.municipality.toLowerCase().includes(q.toLowerCase())),[q]);
  const sorted=useMemo(()=>sort.apply(filtered),[filtered,sort.apply]);
  const pg=usePagination(filtered.length,10);
  const totalBudget=PROJECTS.reduce((s,p)=>s+p.budget,0);
  return (
    <div className="flex-1 overflow-auto bg-gray-50" style={{scrollbarWidth:"none"}}>
      <div className="border-b border-amber-200 px-6 py-3 flex items-center gap-3 text-[13px]" style={{background:"#fffbeb"}}>
        <Globe size={15} className="text-amber-600"/>
        <span className="text-amber-800"><strong>Public Transparency Portal</strong> — No login required. DPWH Region III · Open Government Partnership.</span>
        <button onClick={onLogin} className="ml-auto text-[12px] font-semibold text-[#1e3a7b] flex items-center gap-1 hover:underline shrink-0">Sign in for full access<ArrowRight size={11}/></button>
      </div>
      <div className="bg-white border-b border-gray-200 px-8 py-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-5"><div className="w-8 h-8 rounded flex items-center justify-center shrink-0" style={{background:"#f59e0b"}}><Shield size={16} style={{color:"#1e3a7b"}}/></div><div><div className="text-xl font-bold text-gray-900">Flood Control Projects — Province of Bulacan</div><div className="text-[13px] text-gray-500">DPWH Region III · Open Data · FOI-Compliant (EO No. 2)</div></div></div>
          <div className="grid grid-cols-4 gap-4">
            {[{l:"Total Projects",v:String(PROJECTS.length),s:"Bulacan Province",c:"#1e3a7b"},{l:"Total Budget",v:peso(totalBudget),s:"Combined contract value",c:"#16a34a"},{l:"Completed",v:String(PROJECTS.filter(p=>p.status==="completed").length),s:`${Math.round(PROJECTS.filter(p=>p.status==="completed").length/PROJECTS.length*100)}% completion rate`,c:"#16a34a"},{l:"Under Review",v:String(PROJECTS.filter(p=>p.status==="flagged").length),s:"Flagged for investigation",c:"#f59e0b"}].map(k=>(
              <div key={k.l} className="bg-white border border-gray-200 rounded p-4"><div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{k.l}</div><div className="font-mono font-bold text-2xl" style={{color:k.c}}>{k.v}</div><div className="text-[11px] text-gray-500 mt-0.5">{k.s}</div></div>
            ))}
          </div>
        </div>
      </div>
      <div className="px-8 py-6 max-w-5xl mx-auto space-y-5">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm"><Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/><input value={q} onChange={e=>{setQ(e.target.value);pg.reset();}} placeholder="Search by name or municipality…" aria-label="Search projects" className="w-full pl-9 pr-4 py-2.5 text-[13px] border border-gray-200 rounded bg-white focus:outline-none focus:border-[#1e3a7b]"/></div>
          <span className="text-[13px] text-gray-500">{filtered.length} of {PROJECTS.length} projects</span>
        </div>
        <div className="bg-white rounded border border-gray-200 overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <SortTh col={"name" as keyof Project}         label="Project Name"  sortKey={sort.sortKey as keyof Project|null} sortDir={sort.sortDir} onSort={sort.toggle as (k:keyof Project)=>void}/>
                <SortTh col={"municipality" as keyof Project} label="Municipality"  sortKey={sort.sortKey as keyof Project|null} sortDir={sort.sortDir} onSort={sort.toggle as (k:keyof Project)=>void}/>
                <SortTh col={"contractor" as keyof Project}   label="Contractor"    sortKey={sort.sortKey as keyof Project|null} sortDir={sort.sortDir} onSort={sort.toggle as (k:keyof Project)=>void}/>
                <SortTh col={"budget" as keyof Project}       label="Budget"        sortKey={sort.sortKey as keyof Project|null} sortDir={sort.sortDir} onSort={sort.toggle as (k:keyof Project)=>void}/>
                <SortTh col={"completion" as keyof Project}   label="Progress"      sortKey={sort.sortKey as keyof Project|null} sortDir={sort.sortDir} onSort={sort.toggle as (k:keyof Project)=>void}/>
                <SortTh col={"status" as keyof Project}       label="Status"        sortKey={sort.sortKey as keyof Project|null} sortDir={sort.sortDir} onSort={sort.toggle as (k:keyof Project)=>void}/>
              </tr>
            </thead>
            <tbody>
              {pg.paginate(sorted).length===0?(<tr><td colSpan={6}><EmptyState title="No projects found" body={`No results for "${q}"`}/></td></tr>):pg.paginate(sorted).map(p=>(
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5"><div className="font-semibold text-gray-900">{p.name}</div><div className="text-[11px] font-mono text-gray-400 mt-0.5">{p.id} · {p.fundingSource}</div></td>
                  <td className="px-5 py-3.5 text-gray-600">{p.municipality}</td>
                  <td className="px-5 py-3.5 text-gray-600">{p.contractor}</td>
                  <td className="px-5 py-3.5 font-mono font-semibold text-gray-800 whitespace-nowrap">{pesoFull(p.budget)}</td>
                  <td className="px-5 py-3.5 min-w-[140px]"><div className="flex items-center gap-2"><div className="flex-1 bg-gray-100 rounded-full h-2" role="progressbar" aria-valuenow={p.completion} aria-valuemin={0} aria-valuemax={100}><div className="h-2 rounded-full" style={{width:`${p.completion}%`,background:STATUS_CFG[p.status].dot}}/></div><span className="font-mono text-[11px] text-gray-500 w-8 text-right">{p.completion}%</span></div></td>
                  <td className="px-5 py-3.5"><StatusBadge status={p.status}/></td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={pg.page} totalPages={Math.ceil(filtered.length/pg.pageSize)} setPage={pg.setPage} total={filtered.length} pageSize={pg.pageSize}/>
        </div>
        <div className="bg-white rounded border border-gray-200 p-6">
          <div className="flex items-start gap-3">
            <CheckSquare size={18} className="text-[#1e3a7b] shrink-0 mt-0.5"/>
            <div className="flex-1">
              <div className="text-[14px] font-bold text-gray-900 mb-1">Freedom of Information (FOI) Request</div>
              <p className="text-[13px] text-gray-500 mb-4">Request project documents under Executive Order No. 2.</p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <input placeholder="Your full name" aria-label="Full name" className="px-3 py-2 text-[13px] border border-gray-200 rounded focus:outline-none focus:border-[#1e3a7b]"/>
                <input placeholder="Email address" type="email" aria-label="Email address" className="px-3 py-2 text-[13px] border border-gray-200 rounded focus:outline-none focus:border-[#1e3a7b]"/>
              </div>
              <textarea rows={3} placeholder="Describe the information you are requesting and the reason for your request…" aria-label="FOI request description" className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded focus:outline-none focus:border-[#1e3a7b] resize-none mb-3"/>
              <button onClick={()=>toast.success("FOI request submitted. Response within 15 working days.")} className="px-5 py-2.5 text-[13px] font-semibold text-white rounded hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#1e3a7b] focus:ring-offset-2" style={{background:"#1e3a7b"}}>Submit FOI Request</button>
            </div>
          </div>
        </div>
        <p className="text-center text-[11px] text-gray-400 pb-4">Data updated daily · Philippine FOI Program · Open Government Partnership · DICT Open Data Portal</p>
      </div>
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [isLoggedIn,setIsLoggedIn]    = useState(false);
  const [userRole,setUserRole]        = useState<Role>("dpwh-admin");
  const [screen,setScreen]            = useState<Screen>("dashboard");
  const [sidebarCollapsed,setSidebar] = useState(false);
  const [selectedProjectId,setSelId]  = useState(PROJECTS[0].id);
  const [notificationsOpen,setNotifs] = useState(false);
  const [paletteOpen,setPalette]      = useState(false);
  const [createModalOpen,setCreate]   = useState(false);
  const [notifications,setNotifications] = useState(NOTIFICATIONS);
  // Filters initialise from the URL so a filtered view can be shared as a link,
  // which is the whole point of a transparency register.
  const [filters,setFilters]          = useState<Filters>(()=>fromQuery(window.location.search.slice(1)));


  const handleViewDetail = (id:string) => { setSelId(id); setScreen("project-detail"); };
  const handleLogin   = (role:Role) => { setUserRole(role); setIsLoggedIn(true); setScreen(role==="public"?"transparency":"dashboard"); toast.success(`Welcome back${role==="public"?"":", A. Reyes"}!`); };
  const handleLogout  = () => { setIsLoggedIn(false); toast.info("Signed out."); };
  const handleMarkAllRead = () => setNotifications(ns=>ns.map(n=>({...n,read:true})));
  const handleNavigate= (s:Screen) => { setScreen(s); setNotifs(false); setPalette(false); };

  // Global keyboard shortcuts
  useEffect(()=>{
    const handler=(e:KeyboardEvent)=>{
      const meta=e.metaKey||e.ctrlKey;
      if(meta&&e.key==="k"){ e.preventDefault(); setPalette(v=>!v); }
      if(e.key==="Escape")  { setPalette(false); setNotifs(false); }
    };
    window.addEventListener("keydown",handler);
    return ()=>window.removeEventListener("keydown",handler);
  },[]);

  const visibleProjects = useMemo(()=>applyFilters(filters),[filters]);
  useEffect(()=>{
    const qs=toQueryString(filters);
    window.history.replaceState(null,"",qs?`?${qs}`:window.location.pathname);
  },[filters]);
  const selectedProject = PROJECTS.find(p=>p.id===selectedProjectId)??PROJECTS[0];
  const unreadCount     = notifications.filter(n=>!n.read).length;
  const canCreate       = ["dpwh-admin","dpwh-engineer"].includes(userRole);
  const showSidebar     = screen==="map";

  if(!isLoggedIn) return (
    <>
      <LoginScreen onLogin={handleLogin}/>
      <Toaster position="bottom-right" richColors/>
    </>
  );

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden" style={{fontFamily:"Inter, sans-serif"}}>
      <Toaster position="bottom-right" richColors/>

      {paletteOpen&&(
        <CommandPalette onClose={()=>setPalette(false)} onNavigate={handleNavigate} onCreate={()=>{setCreate(true);setPalette(false);}}/>
      )}

      {createModalOpen&&<CreateProjectModal onClose={()=>setCreate(false)} onSave={()=>{}}/>}

      <div className="relative shrink-0">
        <TopNav screen={screen} onNavigate={handleNavigate} onToggleSidebar={()=>setSidebar(v=>!v)}
          onToggleNotifications={()=>setNotifs(v=>!v)} unreadCount={unreadCount} role={userRole}
          onLogout={handleLogout} onCreateProject={()=>setCreate(true)} canCreate={canCreate}
          onOpenPalette={()=>setPalette(true)}/>
        {notificationsOpen&&(
          <NotificationsPanel onClose={()=>setNotifs(false)} notifications={notifications} onMarkAllRead={handleMarkAllRead}/>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {showSidebar&&(
          <FilterPanel filters={filters} setFilters={setFilters} collapsed={sidebarCollapsed}/>
        )}
        <main className="flex-1 flex overflow-hidden" role="main">
          {screen==="dashboard"    &&<DashboardScreen onNavigate={handleNavigate} onViewDetail={handleViewDetail}/>}
          {screen==="map"          &&<MapScreen projects={visibleProjects} onViewDetail={handleViewDetail} filters={filters} onClearFilters={()=>setFilters(emptyFilters())}/>}
          {screen==="project-detail"&&<ProjectDetailScreen project={selectedProject} onBack={()=>setScreen("map")} onOpenSatellite={()=>setScreen("satellite")}/>}
          {screen==="satellite"    &&<SatelliteScreen project={selectedProject}/>}
          {screen==="documents"    &&<DocumentsScreen/>}
          {screen==="citizen-report"&&<CitizenReportScreen/>}
          {screen==="contractors"  &&<ContractorsScreen/>}
          {screen==="admin"        &&<AdminScreen/>}
          {screen==="transparency" &&<TransparencyScreen onLogin={()=>setIsLoggedIn(false)}/>}
        </main>
      </div>
    </div>
  );
}
