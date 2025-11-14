'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Code } from 'lucide-react';

interface Wallet {
  id: string;
  address: string;
  blockchain: string;
}

interface ContractExecutorProps {
  wallets: Wallet[];
}

export function ContractExecutor({ wallets }: ContractExecutorProps) {
  const [walletId, setWalletId] = useState<string>('');
  const [contractAddress, setContractAddress] = useState<string>('');
  const [functionSig, setFunctionSig] = useState<string>('');
  const [parameters, setParameters] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; txId?: string } | null>(null);

  // Preset contract calls for Arc testnet Counter
  const presets = [
    {
      name: 'Counter: Increment by 1',
      contractAddress: '0xB070f8E15B34333A70C9Ac3158363a1d8667e617', // Arc testnet Counter
      functionSig: 'inc()',
      params: '[]',
      description: 'Increment counter by 1 on Arc testnet'
    },
    {
      name: 'Counter: Increment by 5',
      contractAddress: '0xB070f8E15B34333A70C9Ac3158363a1d8667e617',
      functionSig: 'incBy(uint256)',
      params: '[5]',
      description: 'Increment counter by 5 on Arc testnet'
    },
    {
      name: 'Counter: Increment by 10',
      contractAddress: '0xB070f8E15B34333A70C9Ac3158363a1d8667e617',
      functionSig: 'incBy(uint256)',
      params: '[10]',
      description: 'Increment counter by 10 on Arc testnet'
    }
  ];

  const handleExecute = async () => {
    if (!walletId || !contractAddress || !functionSig) {
      setResult({ success: false, message: 'Please fill required fields' });
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      let parsedParams = [];
      if (parameters.trim()) {
        try {
          parsedParams = JSON.parse(parameters);
        } catch (e) {
          throw new Error('Invalid JSON parameters format');
        }
      }

      const response = await fetch('/api/circle/contract-execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletId,
          contractAddress,
          abiFunctionSignature: functionSig,
          abiParameters: parsedParams
        })
      });

      const data = await response.json();

      if (data.success) {
        setResult({
          success: true,
          message: `Contract execution initiated! Transaction ID: ${data.data?.id}`,
          txId: data.data?.id
        });
      } else {
        setResult({ success: false, message: data.error || 'Execution failed' });
      }
    } catch (error: any) {
      setResult({ success: false, message: error.message || 'Execution failed' });
    } finally {
      setLoading(false);
    }
  };

  const loadPreset = (preset: typeof presets[0]) => {
    setContractAddress(preset.contractAddress);
    setFunctionSig(preset.functionSig);
    setParameters(preset.params);
  };

  return (
    <Card className="p-6 space-y-4">
      <div>
        <h2 className="text-2xl font-bold">Contract Execution (Track 1)</h2>
        <p className="text-sm text-gray-600 mt-1">
          Execute smart contract functions with programmable logic
        </p>
      </div>

      <div className="space-y-4">
        {/* Presets */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Quick Presets
          </label>
          <div className="grid grid-cols-1 gap-2">
            {presets.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => loadPreset(preset)}
                className="text-left px-3 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-md text-sm"
              >
                <div className="font-medium">{preset.name}</div>
                <div className="text-xs text-gray-500">{preset.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Wallet Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Executing Wallet
          </label>
          <select
            value={walletId}
            onChange={(e) => setWalletId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select wallet...</option>
            {wallets.map(wallet => (
              <option key={wallet.id} value={wallet.id}>
                {wallet.address} ({wallet.blockchain})
              </option>
            ))}
          </select>
        </div>

        {/* Contract Address */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Contract Address
          </label>
          <input
            type="text"
            value={contractAddress}
            onChange={(e) => setContractAddress(e.target.value)}
            placeholder="0x..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Function Signature */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Function Signature
          </label>
          <input
            type="text"
            value={functionSig}
            onChange={(e) => setFunctionSig(e.target.value)}
            placeholder="functionName(address,uint256)"
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Example: transfer(address,uint256)
          </p>
        </div>

        {/* Parameters */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Parameters (JSON Array)
          </label>
          <textarea
            value={parameters}
            onChange={(e) => setParameters(e.target.value)}
            placeholder='["0x...", "1000000"]'
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            JSON array format: ["param1", "param2", ...]
          </p>
        </div>

        {/* Result */}
        {result && (
          <div className={`p-4 rounded-md ${result.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <p className={`text-sm ${result.success ? 'text-green-800' : 'text-red-800'}`}>
              {result.message}
            </p>
          </div>
        )}

        {/* Execute Button */}
        <Button
          onClick={handleExecute}
          disabled={loading || !walletId || !contractAddress || !functionSig}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Executing...
            </>
          ) : (
            <>
              <Code className="mr-2 h-4 w-4" />
              Execute Contract
            </>
          )}
        </Button>

        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 text-sm space-y-2">
          <p className="font-semibold text-blue-900">📝 How to use for Track 1:</p>
          <ol className="list-decimal list-inside space-y-1 text-blue-800">
            <li>Deploy your smart contract on Arc testnet (use Hardhat/Foundry)</li>
            <li>Add advanced logic (escrow, conditions, multi-sig, etc.)</li>
            <li>Use this tool to interact with your deployed contract</li>
            <li>Show programmable money in action!</li>
          </ol>
        </div>
      </div>
    </Card>
  );
}
