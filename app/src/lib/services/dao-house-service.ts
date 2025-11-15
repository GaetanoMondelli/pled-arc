import { pledStorageService } from './pled-storage-service';

export interface Officer {
  id: string;
  name: string;
  role: string;
  appointedDate: string;
  wallets: WalletInfo[];
  allocationPercentage: number;
}

export interface WalletInfo {
  walletId: string;
  address: string;
  blockchain: string;
  balance: string;
  token: string;
}

export interface Company {
  id: string;
  number: string;
  name: string;
  status: string;
  registeredOfficeAddress: string;
  companyType: string;
  incorporatedOn: string;
  officers: Officer[];
}

export interface FilingDocument {
  id: string;
  companyId: string;
  executionId: string;
  name: string;
  type: 'profit-loss' | 'payroll' | 'resolution' | 'shareholder-update';
  filedDate: string;
  description: string;
  status: 'pending' | 'processed' | 'approved' | 'executed';
  formats: {
    pdf?: string;
    json?: string;
    text?: string;
    markdown?: string;
  };
}

class DAOHouseService {
  private basePath = 'arcpled/dao-house';

  // Company methods
  async getCompany(companyId: string): Promise<Company | null> {
    try {
      const path = `${this.basePath}/companies/${companyId}/profile.json`;
      return await pledStorageService.downloadJSON(path);
    } catch (error) {
      console.error('Error getting company:', error);
      return null;
    }
  }

  async saveCompany(company: Company): Promise<void> {
    const path = `${this.basePath}/companies/${company.id}/profile.json`;
    await pledStorageService.uploadJSON(path, company);
  }

  async listCompanies(): Promise<Company[]> {
    try {
      const files = await pledStorageService.listFiles(`${this.basePath}/companies/`);
      const companies: Company[] = [];

      for (const file of files) {
        if (file.name.endsWith('profile.json')) {
          try {
            const company = await pledStorageService.downloadJSON(file.name);
            companies.push(company);
          } catch (err) {
            console.error(`Error loading company from ${file.name}:`, err);
          }
        }
      }

      return companies;
    } catch (error) {
      console.error('Error listing companies:', error);
      return [];
    }
  }

  // People directory methods
  async getPeopleDirectory(): Promise<Officer[]> {
    try {
      const path = `${this.basePath}/people/directory.json`;
      const data = await pledStorageService.downloadJSON(path);
      return data.people || [];
    } catch (error) {
      console.error('Error getting people directory:', error);
      return [];
    }
  }

  async savePeopleDirectory(people: Officer[]): Promise<void> {
    const path = `${this.basePath}/people/directory.json`;
    await pledStorageService.uploadJSON(path, { people, updatedAt: Date.now() });
  }

  // Document methods
  async uploadDocument(
    companyId: string,
    executionId: string,
    file: File
  ): Promise<string> {
    const timestamp = Date.now();
    const docId = `doc-${timestamp}`;
    const fileName = file.name;

    // Upload original file
    const buffer = Buffer.from(await file.arrayBuffer());
    const originalPath = `${this.basePath}/documents/${companyId}/${executionId}/original/${fileName}`;

    await pledStorageService.uploadBuffer(originalPath, buffer, {
      contentType: file.type,
      metadata: {
        documentId: docId,
        uploadedAt: timestamp.toString(),
        originalName: fileName,
      },
    });

    return docId;
  }

  async saveDocumentFormat(
    companyId: string,
    executionId: string,
    documentName: string,
    format: 'json' | 'text' | 'markdown',
    content: string
  ): Promise<void> {
    const extension = format === 'json' ? 'json' : format === 'text' ? 'txt' : 'md';
    const baseName = documentName.replace(/\.[^/.]+$/, ''); // Remove extension
    const path = `${this.basePath}/documents/${companyId}/${executionId}/formats/${baseName}.${extension}`;

    if (format === 'json') {
      await pledStorageService.uploadJSON(path, JSON.parse(content));
    } else {
      await pledStorageService.uploadText(path, content);
    }
  }

  async getDocumentFormat(
    companyId: string,
    executionId: string,
    documentName: string,
    format: 'json' | 'text' | 'markdown'
  ): Promise<any> {
    const extension = format === 'json' ? 'json' : format === 'text' ? 'txt' : 'md';
    const baseName = documentName.replace(/\.[^/.]+$/, '');
    const path = `${this.basePath}/documents/${companyId}/${executionId}/formats/${baseName}.${extension}`;

    if (format === 'json') {
      return await pledStorageService.downloadJSON(path);
    } else {
      return await pledStorageService.downloadText(path);
    }
  }

  async saveFilingMetadata(filing: FilingDocument): Promise<void> {
    const path = `${this.basePath}/documents/${filing.companyId}/${filing.executionId}/metadata.json`;
    await pledStorageService.uploadJSON(path, filing);
  }

  async getFilingMetadata(companyId: string, executionId: string): Promise<FilingDocument | null> {
    try {
      const path = `${this.basePath}/documents/${companyId}/${executionId}/metadata.json`;
      return await pledStorageService.downloadJSON(path);
    } catch (error) {
      console.error('Error getting filing metadata:', error);
      return null;
    }
  }

  async listFilings(companyId: string): Promise<FilingDocument[]> {
    try {
      const prefix = `${this.basePath}/documents/${companyId}/`;
      const files = await pledStorageService.listFiles(prefix);
      const filings: FilingDocument[] = [];

      for (const file of files) {
        if (file.name.endsWith('metadata.json')) {
          try {
            const filing = await pledStorageService.downloadJSON(file.name);
            filings.push(filing);
          } catch (err) {
            console.error(`Error loading filing from ${file.name}:`, err);
          }
        }
      }

      return filings.sort((a, b) =>
        new Date(b.filedDate).getTime() - new Date(a.filedDate).getTime()
      );
    } catch (error) {
      console.error('Error listing filings:', error);
      return [];
    }
  }
}

export const daoHouseService = new DAOHouseService();
