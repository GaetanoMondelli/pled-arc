"use client";

import { useEffect, useState } from "react";
import ActionList from "@/components/ui/action-list";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import EventList from "@/components/ui/event-list";
import MessageRules from "@/components/ui/message-rules";
import ProcedureState from "@/components/ui/procedure-state";
import StateGraph from "@/components/ui/state-graph";
import { sm } from "jssm";

interface ProcedureContentProps {
  procedureId: string;
  activeSubsection: string;
  selectedProcedure: string | null;
}

export default function ProcedureContent({ procedureId, activeSubsection, selectedProcedure }: ProcedureContentProps) {
  const procedure = {
    id: procedureId,
    name: "Procedure Name", // You might want to fetch the actual name based on the ID
    description: "Procedure Description", // Fetch the actual description
  };

  useEffect(() => {
    if (selectedProcedure) {
      // Logic to set the first tab (events) as active
      // This might involve setting a state or calling a function to update the tab
    }
  }, [selectedProcedure]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{selectedProcedure ? selectedProcedure : "Select a procedure"}</CardTitle>
        <CardDescription>{procedure.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {activeSubsection === "Events" && <EventList procedureId={procedureId.toString()} />}
        {activeSubsection === "Messages" && <MessageRules procedureId={procedureId.toString()} />}
        {/* {activeSubsection === "State" && (
        //   <ProcedureState procedureId={procedureId.toString()} />
        )} */}
        {activeSubsection === "Actions" && <ActionList procedureId={procedureId.toString()} />}
      </CardContent>
    </Card>
  );
}
