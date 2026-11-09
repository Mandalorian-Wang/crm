"use client";
import { useState } from "react";
import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";

export function DataTableRangeFilter({label,type,selected,onChange}:{label:string;type:"number"|"date";selected:string[];onChange:(values:string[])=>void}) {
    const [minimum,setMinimum]=useState(selected.find(v=>v.startsWith("min:"))?.slice(4) ?? "");
    const [maximum,setMaximum]=useState(selected.find(v=>v.startsWith("max:"))?.slice(4) ?? "");
    const invalid = minimum !== "" && maximum !== "" && (type === "number" ? Number(minimum)>Number(maximum) : minimum>maximum);
    return <form className="grid gap-3 p-3" onSubmit={event=>{event.preventDefault();if(!invalid)onChange([...(minimum ? [`min:${minimum}`]:[]),...(maximum ? [`max:${maximum}`]:[])]);}} onKeyDown={event=>event.stopPropagation()}>
        <Label>{type === "date" ? "From (Shanghai)" : "Minimum"}<Input aria-label={`${label} minimum`} type={type} step={type === "number" ? "0.0001" : undefined} value={minimum} onChange={event=>setMinimum(event.target.value)} /></Label>
        <Label>{type === "date" ? "Through (Shanghai)" : "Maximum"}<Input aria-label={`${label} maximum`} type={type} step={type === "number" ? "0.0001" : undefined} value={maximum} onChange={event=>setMaximum(event.target.value)} /></Label>
        {invalid ? <p role="alert" className="text-sm text-destructive">Minimum must not exceed maximum.</p> : null}
        <div className="flex gap-2"><Button type="submit" size="sm" disabled={invalid}>Apply range</Button><Button type="button" variant="outline" size="sm" onClick={()=>{setMinimum("");setMaximum("");onChange([]);}}>Clear range</Button></div>
    </form>;
}
