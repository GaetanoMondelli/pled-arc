import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card } from "./card";
import { ScrollArea } from "./scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./tabs";
import { BookOpen, File, FileText } from "lucide-react";

export const EnvelopeView = ({ procedureId, template }: { procedureId: string; template: any }) => {
  const searchParams = useSearchParams();
  const selectedDoc = searchParams?.get("doc");

  const documents = template?.documents?.contracts || [];

  return (
    <Card className="p-4">
      <ScrollArea className="h-[calc(100vh-12rem)]">
        {selectedDoc ? (
          // Show single document view
          <DocumentDetail
            document={documents.find((d: { id: string }) => d.id === selectedDoc)}
            procedureId={procedureId}
          />
        ) : (
          // Show document list
          <div className="space-y-4">
            {documents.map((doc: { id: string; name: string; linkedStates?: string[] }) => (
              <Link
                key={doc.id}
                href={`/procedures/${procedureId}/envelope?doc=${doc.id}`}
                className="block p-4 border rounded-lg hover:bg-accent"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">{doc.name}</h3>
                    <p className="text-sm text-muted-foreground">Linked to: {doc.linkedStates?.join(", ")}</p>
                  </div>
                  <FileText className="h-4 w-4 stroke-current fill-none" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </ScrollArea>
    </Card>
  );
};

const DocumentDetail = ({ document, procedureId }: { document: any; procedureId: string }) => {
  if (!document) return null;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Link
          href={`/procedures/${procedureId}/envelope`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to documents
        </Link>
      </div>
      <h2 className="text-xl font-bold">{document.name}</h2>
      <div className="prose max-w-none">
        <pre className="p-4 bg-muted rounded-lg">{document.content}</pre>
      </div>
      <div>
        <h3 className="font-medium mb-2">Linked States</h3>
        <ul className="list-disc list-inside">
          {document.linkedStates?.map((state: string) => <li key={state}>{state}</li>)}
        </ul>
      </div>
    </div>
  );
};

export default EnvelopeView;
