"use client";

import { useEffect, useState } from "react";
import { getValueByPath } from "../../utils/eventMatching";
import { Card } from "./card";
import { ScrollArea } from "./scroll-area";

interface VariablesViewProps {
  procedureId: string;
}

export const VariablesView = ({ procedureId }: VariablesViewProps) => {
  const [instance, setInstance] = useState<any>(null);
  const [template, setTemplate] = useState<any>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`/api/procedures/${procedureId}`);
        if (!response.ok) throw new Error("Failed to fetch procedure data");
        const data = await response.json();
        setInstance(data.instance);
        setTemplate(data.template);
      } catch (error) {
        console.error("Error fetching procedure data:", error);
      }
    }
    fetchData();
  }, [procedureId]);

  const getCapturedOutputs = () => {
    if (!instance || !template) return {};
    const outputs: Record<string, Record<string, any>> = {};

    instance?.messages?.forEach((message: any) => {
      const rule = template?.messageRules.find((r: any) => r.id === message.rule);
      if (rule?.captures) {
        if (!outputs[message.type]) {
          outputs[message.type] = {};
        }
        Object.entries(rule.captures).forEach(([key, pathTemplate]: [string, any]) => {
          const event = instance.events.find((e: any) => e.id === message.fromEvent);
          if (event) {
            const pathMatch = pathTemplate.toString().match(/{{event\.data\.(.+)}}/);
            if (pathMatch && pathMatch[1]) {
              const path = pathMatch[1];
              const value = getValueByPath(event.data, path);
              if (value !== undefined) {
                outputs[message.type][key] = value;
              }
            }
          }
        });
      }
    });

    return outputs;
  };

  const getAllVariables = () => {
    const baseVars = instance?.variables || {};
    const capturedVars = getCapturedOutputs();

    // Convert captured vars to match instance variables format
    const capturedFormatted = Object.entries(capturedVars).reduce(
      (acc, [messageType, captures]) => {
        const sectionName = `${messageType} outputs`;
        acc[sectionName] = captures;
        return acc;
      },
      {} as Record<string, any>,
    );

    return {
      ...baseVars,
      ...capturedFormatted,
    };
  };

  return (
    <Card className="w-full">
      <ScrollArea className="h-[85vh]">
        <div className="p-4 space-y-4">
          <h3 className="font-semibold">Variables</h3>
          {Object.entries(getAllVariables()).map(([section, vars]: [any, any]) => (
            <div key={section} className="space-y-1">
              <h4 className="text-sm font-medium capitalize">{section}</h4>
              <div className="pl-2 space-y-1">
                {Object.entries(vars).map(([key, value]: [any, any]) => (
                  <div key={key} className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500">{key}:</span>
                    <span className="font-mono">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
};
