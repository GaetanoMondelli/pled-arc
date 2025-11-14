import { useCallback } from "react";
import type { Connection } from "reactflow";
import type { Scenario } from "@/lib/simulation/types";
import { useSimulationStore } from "@/stores/simulationStore";

export const useEdgeGeneration = (
  scenario: Scenario | null,
  saveSnapshot: (description: string) => void,
  loadScenario: (scenario: any) => Promise<void>
) => {
  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target || !scenario) return;

      const sourceNode = scenario.nodes.find(n => n.nodeId === params.source);
      const targetNode = scenario.nodes.find(n => n.nodeId === params.target);
      
      console.log('🔗 [CONNECT] Attempting connection:', {
        source: params.source,
        sourceType: sourceNode?.type,
        sourceHandle: params.sourceHandle,
        sourceOutputs: sourceNode?.outputs?.map(o => o.name),
        sourceFsmOutputs: (sourceNode as any)?.fsm?.outputs,
        target: params.target,
        targetType: targetNode?.type,
        targetHandle: params.targetHandle,
        targetInputs: targetNode?.inputs?.map(i => i.name),
      });

      // Validate that source and target nodes exist
      if (!sourceNode || !targetNode) {
        console.error('❌ [CONNECT] Source or target node not found!');
        return;
      }
      
      // CRITICAL: Validate source handle exists
      if (!params.sourceHandle) {
        console.error('❌ [CONNECT] No sourceHandle provided!', params);
        return;
      }

      // Save snapshot before creating connection
      saveSnapshot('Create connection');

      // Update the scenario JSON to reflect the new connection
      const updatedNodes = scenario.nodes.map(node => {
        if (node.nodeId === params.source) {
          // Get the source handle name (this is what the user connected from)
          const sourceHandleName = params.sourceHandle || 'output';
          
          // Special handling for FSMProcessNode - ensure it has the required output structure
          if (node.type === 'FSMProcessNode') {
            const outputName = sourceHandleName || 'state';
            
            console.log('🔗 [FSM CONNECT] Connecting FSM output:', {
              handleName: sourceHandleName,
              outputName,
              fsmOutputs: (node as any)?.fsm?.outputs,
              existingOutputs: node.outputs?.map(o => o.name)
            });
            
            // Check if node already has outputs array
            if (node.outputs && node.outputs.length > 0) {
              // Check if this specific output already exists
              const existingOutputIndex = node.outputs.findIndex(o => o.name === outputName);
              
              if (existingOutputIndex !== -1) {
                // Update existing output
                const updatedOutputs = node.outputs.map(output => {
                  if (output.name === outputName) {
                    console.log('🔄 Updating existing FSM output:', outputName);
                    return {
                      ...output,
                      destinationNodeId: params.target,
                      destinationInputName: params.targetHandle || 'input'
                    };
                  }
                  return output;
                });
                return { ...node, outputs: updatedOutputs };
              } else {
                // Add new output to existing array
                console.log('➕ Adding new FSM output:', outputName);
                return {
                  ...node,
                  outputs: [...node.outputs, {
                    name: outputName,
                    destinationNodeId: params.target,
                    destinationInputName: params.targetHandle || 'input',
                    interface: { type: 'StateContext', requiredFields: ['data.currentState', 'data.context'] }
                  }]
                };
              }
            } else {
              // Create new outputs array
              console.log('🆕 Creating new FSM outputs array with:', outputName);
              return {
                ...node,
                outputs: [{
                  name: outputName,
                  destinationNodeId: params.target,
                  destinationInputName: params.targetHandle || 'input',
                  interface: { type: 'StateContext', requiredFields: ['data.currentState', 'data.context'] }
                }]
              };
            }
          }
          
          // Handle nodes with outputs array (V3 format) - for other node types
          if (node.outputs && node.outputs.length > 0) {
            let matchingOutputName = sourceHandleName;
            if (node.type === 'ProcessNode' && sourceHandleName.startsWith('output-')) {
              matchingOutputName = sourceHandleName.replace('output-', '');
            }
            
            const updatedOutputs = node.outputs.map(output => {
              if (output.name === matchingOutputName) {
                return {
                  ...output,
                  destinationNodeId: params.target,
                  destinationInputName: params.targetHandle || 'input'
                };
              }
              return output;
            });
            return { ...node, outputs: updatedOutputs };
          }
        }

        // Also update the target node's inputs if needed
        if (node.nodeId === params.target) {
          let inputName = params.targetHandle || 'input';
          let sourceOutputName = params.sourceHandle || 'output';
          
          // Normalize source output name based on source node type
          const sourceNode = scenario.nodes.find(n => n.nodeId === params.source);
          if (sourceNode?.type === 'ProcessNode' && sourceOutputName.startsWith('output-')) {
            sourceOutputName = sourceOutputName.replace('output-', '');
          }

          // Initialize inputs array if it doesn't exist
          const currentInputs = node.inputs || [];
          
          // Check if this node type supports multiple inputs
          const singleInputNodeTypes = ['Sink', 'Queue', 'StateMultiplexer', 'FSMProcessNode'];
          const isSingleInputNode = singleInputNodeTypes.includes(node.type);
          const isMultiInputNode = node.type === 'ProcessNode';
          
          console.log(`🔗 [INPUT HANDLING] Target: ${node.type}, handle: ${inputName}, existingInputs: ${currentInputs.length}`, {
            isSingleInputNode,
            isMultiInputNode,
            currentInputNames: currentInputs.map(i => i.name)
          });
          
          // For multi-input nodes (ProcessNode), generate unique input names
          if (isMultiInputNode && inputName === 'input' && currentInputs.length > 0) {
            let counter = 1;
            while (currentInputs.some(inp => inp.name === `input_${counter}`)) {
              counter++;
            }
            inputName = `input_${counter}`;
            console.log(`🆕 [MULTI-INPUT] Generated new input name: ${inputName} for ProcessNode`);
          }
          
          if (isSingleInputNode) {
            console.log(`🔄 [SINGLE-INPUT] ${node.type} supports only one input connection via handle "${inputName}"`);
          }
          
          // Check if this EXACT input connection already exists
          const existingInputIndex = currentInputs.findIndex(input => 
            input.name === inputName && input.nodeId === params.source
          );
          
          if (existingInputIndex !== -1) {
            console.log(`✏️ Updating existing input ${inputName} on ${node.nodeId} from ${params.source}`);
            const updatedInputs = currentInputs.map((input, idx) => {
              if (idx === existingInputIndex) {
                return {
                  ...input,
                  nodeId: params.source,
                  sourceOutputName: sourceOutputName
                };
              }
              return input;
            });
            return { ...node, inputs: updatedInputs };
          }
          
          // Check if there's an input with same name but different source
          const inputWithSameNameIndex = currentInputs.findIndex(input => input.name === inputName);
          
          if (inputWithSameNameIndex !== -1) {
            const existingInput = currentInputs[inputWithSameNameIndex];
            const oldSourceNode = scenario.nodes.find(n => n.nodeId === existingInput.nodeId);
            const oldSourceStillConnected = oldSourceNode?.outputs?.some(out => 
              out.destinationNodeId === node.nodeId && 
              out.destinationInputName === inputName
            );
            
            if (oldSourceStillConnected) {
              console.log(`🔄 Replacing input ${inputName} on ${node.nodeId} from ${existingInput.nodeId} to ${params.source}`);
            } else {
              console.log(`♻️ Reusing input ${inputName} on ${node.nodeId} for new connection from ${params.source}`);
            }
            
            const updatedInputs = [...currentInputs];
            updatedInputs[inputWithSameNameIndex] = {
              name: inputName,
              nodeId: params.source,
              sourceOutputName: sourceOutputName,
              interface: { type: 'Any', requiredFields: [] },
              required: false
            };
            return { ...node, inputs: updatedInputs };
          }
          
          // No existing input with this name - add new one
          console.log(`➕ Adding new input ${inputName} on ${node.nodeId} from ${params.source}`);
          return {
            ...node,
            inputs: [...currentInputs, {
              name: inputName,
              nodeId: params.source,
              sourceOutputName: sourceOutputName,
              interface: { type: 'Any', requiredFields: [] },
              required: false
            }]
          };
        }

        return node;
      });

      const updatedScenario = { ...scenario, nodes: updatedNodes };
      
      // Log the updated nodes for debugging
      const sourceNodeAfter = updatedNodes.find(n => n.nodeId === params.source);
      const targetNodeAfter = updatedNodes.find(n => n.nodeId === params.target);
      console.log('🔗 [CONNECT] After update - Source outputs:', sourceNodeAfter?.outputs);
      console.log('🔗 [CONNECT] After update - Target inputs:', targetNodeAfter?.inputs);

      loadScenario(updatedScenario);

      // Mark as having unsaved changes after connecting nodes
      useSimulationStore.getState().markAsUnsavedChanges();
    },
    [scenario, saveSnapshot, loadScenario],
  );

  return { onConnect };
};
