import React, { useEffect, useState } from "react";
import { sm } from "jssm";
import { machine_to_svg_string } from "jssm-viz";

interface StateGraphProps {
  definition: string;
  currentState: string;
  actions?: Record<string, any[]>;
  onStateClick?: (state: string) => void;
}

export default function StateGraph({ definition, currentState, actions = {}, onStateClick }: StateGraphProps) {
  const [svg, setSvg] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(true); // Set to true to show debug by default

  useEffect(() => {
    const generateSvg = async () => {
      console.log("State Graph Props:", {
        definition,
        currentState,
        actions,
      });

      // Debug states from FSM
      const states = definition.match(/[a-zA-Z_]+/g) || [];
      console.log("States from FSM:", states);

      // Debug states with actions
      const statesWithActions = Object.keys(actions);
      console.log("States with actions:", statesWithActions);
      console.log("Actions per state:", actions);

      const newStyle = `state ${currentState} : { background-color: green;  corners: rounded; };`;
      const svgData = await machine_to_svg_string(sm`${definition.trim()} \n ${newStyle}`);
      setSvg(svgData);
    };

    generateSvg();
  }, [definition, currentState, actions]);

  return (
    <div>
      {/* Debug Panel */}
      {showDebug && (
        <div className="mb-4 p-4 bg-slate-100 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium">Debug Info</h3>
            <button onClick={() => setShowDebug(false)} className="text-sm text-gray-500 hover:text-gray-700">
              Hide
            </button>
          </div>
          <div className="space-y-2">
            <div>
              <h4 className="text-sm font-medium">Current State:</h4>
              <pre className="text-sm bg-white p-2 rounded">{currentState}</pre>
            </div>
            <div>
              <h4 className="text-sm font-medium">Actions:</h4>
              <pre className="text-sm bg-white p-2 rounded overflow-auto max-h-40">
                {JSON.stringify(actions, null, 2)}
              </pre>
            </div>
            <div>
              <h4 className="text-sm font-medium">FSM Definition:</h4>
              <pre className="text-sm bg-white p-2 rounded overflow-auto max-h-40">{definition}</pre>
            </div>
          </div>
        </div>
      )}

      {/* Graph */}
      {svg ? <div dangerouslySetInnerHTML={{ __html: svg }} /> : <p>Loading...</p>}
    </div>
  );
}
