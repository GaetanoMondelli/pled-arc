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
  executionId?: string;
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
      // Try to load web3-scion company (hardcoded for now)
      const knownCompanyIds = ['web3-scion'];
      const companies: Company[] = [];

      for (const companyId of knownCompanyIds) {
        try {
          const company = await this.getCompany(companyId);
          if (company) {
            companies.push(company);
          }
        } catch (err) {
          console.error(`Error loading company ${companyId}:`, err);
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
    const formatFolder = format === 'json' ? 'json' : format === 'text' ? 'text' : 'markdown';
    const path = `${this.basePath}/documents/${companyId}/${executionId}/${formatFolder}/${baseName}.${extension}`;

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
      const bucket = require('@/lib/firebase-storage').bucket;
      if (!bucket) {
        console.warn('Firebase bucket not available');
        return [];
      }

      // List all files in the company's documents folder
      const prefix = `${this.basePath}/documents/${companyId}/`;
      const [files] = await bucket.getFiles({ prefix });

      // Find all metadata files
      const metadataFiles = files.filter((f: any) => f.name.endsWith('/metadata.json'));

      const filings: FilingDocument[] = [];
      for (const file of metadataFiles) {
        try {
          const [contents] = await file.download();
          const metadata = JSON.parse(contents.toString('utf8'));
          filings.push(metadata);
        } catch (err) {
          console.warn(`Failed to read metadata from ${file.name}:`, err);
        }
      }

      // Sort by filed date (newest first)
      return filings.sort((a, b) =>
        new Date(b.filedDate).getTime() - new Date(a.filedDate).getTime()
      );
    } catch (error) {
      console.error('Error listing filings:', error);
      return [];
    }
  }

  async deleteFilingMetadata(companyId: string, executionId: string, filingId: string): Promise<void> {
    try {
      const path = `${this.basePath}/documents/${companyId}/${executionId}/metadata.json`;
      await pledStorageService.deleteFile(path);
      console.log(`✅ Deleted filing metadata at ${path}`);
    } catch (error) {
      console.error('Error deleting filing metadata:', error);
      throw error;
    }
  }
}

export const daoHouseService = new DAOHouseService();
