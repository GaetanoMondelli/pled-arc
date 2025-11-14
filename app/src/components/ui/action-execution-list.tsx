import { AlertTriangle, Check, Clock } from "lucide-react";

interface ActionExecutionListProps {
  expectedActions: any[];
  executedActions: any[];
  pendingActions: any[];
}

export const ActionExecutionList = ({ expectedActions, executedActions, pendingActions }: ActionExecutionListProps) => {
  if (!expectedActions?.length) {
    return (
      <div className="mt-4 p-4 bg-gray-50 rounded-lg text-gray-500 text-center">No actions should be executed</div>
    );
  }

  return (
    <div className="mt-4">
      <h3 className="text-sm font-medium mb-2">Action Execution Status</h3>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Action</th>
              <th className="px-4 py-2 text-left font-medium">State</th>
              <th className="px-4 py-2 text-left font-medium">Trigger</th>
              <th className="px-4 py-2 text-center font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {expectedActions.map((action, index) => {
              const isPending = pendingActions.some(
                p => p.actionId === action.actionId && p.state === action.state && p.trigger === action.trigger,
              );
              const isExecuted = executedActions.some(
                e => e.actionId === action.actionId && e.state === action.state && e.trigger === action.trigger,
              );

              return (
                <tr
                  key={`${action.actionId}_${action.state}_${action.trigger}_${index}`}
                  className={`
                    ${isExecuted ? "bg-green-50" : isPending ? "bg-orange-50" : "bg-white"}
                  `}
                >
                  <td className="px-4 py-2">{action.type || action.name || action.actionId || "Unknown Action"}</td>
                  <td className="px-4 py-2">{action.state}</td>
                  <td className="px-4 py-2">{action.trigger}</td>
                  <td className="px-4 py-2 text-center">
                    {isExecuted ? (
                      <div className="inline-flex items-center text-green-600">
                        <Check className="h-4 w-4 mr-1" />
                        <span className="text-xs">Executed</span>
                      </div>
                    ) : isPending ? (
                      <div className="inline-flex items-center text-orange-600">
                        <Clock className="h-4 w-4 mr-1" />
                        <span className="text-xs">Pending</span>
                      </div>
                    ) : (
                      <div className="inline-flex items-center text-gray-600">
                        <AlertTriangle className="h-4 w-4 mr-1" />
                        <span className="text-xs">Not Started</span>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pendingActions.length > 0 && (
        <div className="mt-2 text-xs text-orange-600">* Pending actions will be stored after refresh</div>
      )}
    </div>
  );
};
