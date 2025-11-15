"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, AlertCircle, Wand2, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ExternalEventCreatorProps {
  externalQueue?: any; // ExternalEventQueue instance
  engine?: any; // SimulationEngine instance for getting data source nodes
  onEventCreated?: () => void; // Callback to refresh parent component
}

export function ExternalEventCreator({ externalQueue, engine, onEventCreated }: ExternalEventCreatorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [eventData, setEventData] = useState({
    id: '',
    type: 'user_action',
    source: 'web_app',
    timestamp: Date.now(),
    data: JSON.stringify({
      action: 'submit',
      documentId: 'DOC-123',
      userId: 'user123'
    }, null, 2),
    targetDataSourceId: ''
  });
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const { toast } = useToast();


  // Get available data source nodes from engine - ENGINE IS SOURCE OF TRUTH
  const availableDataSources = React.useMemo(() => {
    if (!engine) {
      console.log('⚠️ No engine provided to ExternalEventCreator');
      return [];
    }

    if (!engine.scenario) {
      console.log('⚠️ Engine not initialized with scenario - ensure loadScenario() was called');
      return [];
    }

    try {
      const scenarioInfo = engine.scenario.getScenarioInfo();
      console.log('🔍 DEBUG scenarioInfo:', scenarioInfo);
      console.log('🔍 DEBUG scenarioInfo.nodes:', scenarioInfo?.nodes);
      if (!scenarioInfo?.nodes) {
        console.log('⚠️ No nodes found in engine scenario');
        return [];
      }

      const dataSources = scenarioInfo.nodes
        .filter((node: any) => node.type === 'DataSource')
        .map((node: any) => ({
          id: node.id || node.nodeId,
          name: node.displayName || node.name || node.id || node.nodeId,
          type: node.type
        }));

      console.log('✅ Found DataSources from engine.scenario:', dataSources.length, 'nodes');
      return dataSources;
    } catch (error) {
      console.error('❌ Failed to get DataSources from engine.scenario:', error);
      return [];
    }
  }, [engine, isOpen]);

  // AI-powered event generation
  const handleAIGenerate = async () => {
    if (!aiPrompt.trim()) {
      toast({
        variant: 'destructive',
        title: 'Prompt Required',
        description: 'Please enter a description of the event data you want to generate'
      });
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch('/api/ai/generate-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt })
      });

      const result = await response.json();

      if (result.success && result.data) {
        const eventId = `evt_${Math.random().toString(36).substr(2, 6)}`;
        setEventData(prev => ({
          ...prev,
          id: eventId,
          timestamp: Date.now(),
          data: JSON.stringify(result.data, null, 2)
        }));

        toast({
          title: 'Event Generated',
          description: 'AI generated event data from your description'
        });
      } else {
        throw new Error(result.error || 'Failed to generate event');
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Generation Failed',
        description: error.message || 'Failed to generate event data'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Magic wand auto-populate - generate sample events
  const handleAutoPopulate = () => {
    // Generate a sample number event for quick testing
    const eventId = `evt_${Math.random().toString(36).substr(2, 6)}`;
    const randomValue = Math.floor(Math.random() * 10) + 1; // 1-10 to match scenario

    setEventData(prev => ({
      ...prev,
      id: eventId,
      type: 'number_input',
      source: 'external_input',
      timestamp: Date.now(),
      data: JSON.stringify({ value: randomValue }, null, 2)
    }));

    toast({
      title: 'Auto-populated',
      description: `Generated number event: ${randomValue}`
    });
  };


  const handleSubmit = () => {
    const newErrors: string[] = [];

    // Validation
    if (!eventData.id.trim()) newErrors.push('Event ID is required');
    if (!eventData.type.trim()) newErrors.push('Event type is required');
    if (!eventData.source.trim()) newErrors.push('Event source is required');

    // Validate JSON data
    try {
      JSON.parse(eventData.data);
    } catch (error) {
      newErrors.push('Event data must be valid JSON');
    }

    if (newErrors.length > 0) {
      setErrors(newErrors);
      return;
    }

    if (!externalQueue) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'External queue not available'
      });
      return;
    }

    try {
      // Create external event with user-specified timestamp
      const externalEvent = {
        id: eventData.id,
        timestamp: eventData.timestamp,
        type: eventData.type,
        source: eventData.source,
        data: JSON.parse(eventData.data),
        targetDataSourceId: eventData.targetDataSourceId || undefined
      };

      // Add to external queue
      externalQueue.addEvent(externalEvent);

      toast({
        title: 'External Event Created',
        description: `Event "${eventData.id}" added to external queue`
      });

      // Trigger refresh of parent component
      if (onEventCreated) {
        onEventCreated();
      }

      // Reset form and close
      setEventData({
        id: '',
        type: 'user_action',
        source: 'user_interface',
        timestamp: Date.now(),
        data: '{}',
        targetDataSourceId: ''
      });
      setAiPrompt('');
      setErrors([]);
      setIsOpen(false);

    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Failed to Create Event',
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1"
      >
        <Plus className="w-3 h-3" />
        Add External Event
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Create External Event
            </DialogTitle>
            <DialogDescription>
              Add external events that will be processed by the simulation engine.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">

            {errors.length > 0 && (
              <div className="flex items-start gap-2 p-3 text-sm text-red-700 bg-red-50 rounded-md">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <div className="font-medium">Please fix the following errors:</div>
                  <ul className="mt-1 list-disc list-inside">
                    {errors.map((error, idx) => (
                      <li key={idx}>{error}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="event-id">Event ID</Label>
              <Input
                id="event-id"
                value={eventData.id}
                onChange={(e) => setEventData(prev => ({ ...prev, id: e.target.value }))}
                placeholder="e.g. user_action_001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="timestamp">Timestamp (ms)</Label>
              <Input
                id="timestamp"
                type="number"
                value={eventData.timestamp}
                onChange={(e) => setEventData(prev => ({ ...prev, timestamp: parseInt(e.target.value) || Date.now() }))}
                placeholder="Unix timestamp in milliseconds"
              />
              <p className="text-xs text-gray-500">
                Current time: {new Date(eventData.timestamp).toLocaleString()}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="target-datasource">Target Data Source</Label>
                {eventData.targetDataSourceId && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleAutoPopulate}
                    className="h-6 px-2 text-xs flex items-center gap-1"
                    title="Auto-populate with defaults for this DataSource"
                  >
                    <Wand2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
              <select
                id="target-datasource"
                value={eventData.targetDataSourceId}
                onChange={(e) => setEventData(prev => ({ ...prev, targetDataSourceId: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a DataSource...</option>
                {availableDataSources.map(ds => (
                  <option key={ds.id} value={ds.id}>{ds.name}</option>
                  ))}
                </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ai-prompt">AI Event Generator</Label>
              <div className="flex gap-2">
                <Textarea
                  id="ai-prompt"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Describe the event data you want to generate, e.g., 'OpenAI chat completion response with message, tokens, model fields' or 'Weather API response with temperature, humidity, location'"
                  rows={2}
                  className="flex-1 text-sm"
                />
                <Button
                  type="button"
                  onClick={handleAIGenerate}
                  disabled={isGenerating || !aiPrompt.trim()}
                  className="h-auto px-4"
                  variant="secondary"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4 mr-2" />
                      Generate
                    </>
                  )}
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Use AI to generate realistic event data from natural language description
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="event-data">Event Data (JSON)</Label>
              <Textarea
                id="event-data"
                value={eventData.data}
                onChange={(e) => setEventData(prev => ({ ...prev, data: e.target.value }))}
                placeholder="Enter JSON data for the event"
                rows={4}
                className="font-mono text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              Create Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}