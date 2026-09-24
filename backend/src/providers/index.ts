import { env } from '../config/env';
import { AppError } from '../middleware/error.middleware';
import { ERROR_CODES } from '@civicpulse/shared';
import { IDatabaseProvider } from './database/database.interface';
import { MockDatabaseProvider } from './database/mock.database';
import { FirestoreDatabaseProvider } from './database/firestore.provider';

import { IStorageProvider } from './storage/storage.interface';
import { LocalStorageProvider } from './storage/local.storage';
import { GCSStorageProvider } from './storage/gcs.storage';

import { IAIProvider } from './ai/ai.interface';
import { MockAIProvider } from './ai/mock.ai';
import { GeminiAIProvider } from './ai/gemini.provider';

import { IAIVerificationProvider } from './ai/verification.interface';
import { MockVerificationProvider } from './ai/mock.verification';
import { GeminiVerificationProvider } from './ai/gemini.verification';

import { IGovernanceAIProvider } from './ai/governance.interface';
import { MockGovernanceAIProvider } from './ai/mock.governance';
import { GeminiGovernanceAIProvider } from './ai/gemini.governance';

import { ISimulationAIProvider } from './ai/simulation.interface';
import { MockSimulationAIProvider } from './ai/mock.simulation';
import { GeminiSimulationAIProvider } from './ai/gemini.simulation';

import {
  IGeographyProvider,
  IPopulationProvider,
  IFacilityProvider
} from './reference/reference.interface';
import {
  IDevelopmentIndicatorProvider,
  IPublicInvestmentProvider
} from '@civicpulse/shared';
import {
  MockGeographyProvider,
  MockPopulationProvider,
  MockFacilityProvider,
  MockDevelopmentIndicatorProvider,
  MockPublicInvestmentProvider
} from './reference/mock-reference.providers';
import { StaticGeographyProvider } from './reference/static-geography.provider';
import { StaticPopulationProvider } from './reference/static-population.provider';
import { StaticFacilityProvider } from './reference/static-facility.provider';
import { StaticDevelopmentIndicatorProvider } from './reference/static-development-indicator.provider';
import { StaticPublicInvestmentProvider } from './reference/static-public-investment.provider';

import { IAuthProvider } from './auth/auth.interface';
import { SupabaseAuthProvider } from './auth/supabase.auth.provider';
import { FirebaseAuthProvider } from './auth/firebase.auth.provider';
import { PostgresDatabaseProvider } from './database/postgres.provider';
import { R2StorageProvider } from './storage/r2.storage';
import { OpenAIProvider } from './ai/openai.provider';
import { IEmailProvider } from './email/email.interface';
import { MockEmailProvider } from './email/mock.email';
import { SmtpEmailProvider } from './email/smtp.email';

class ProviderContainer {
  private static dbInstance: IDatabaseProvider | null = null;
  private static authInstance: IAuthProvider | null = null;
  private static storageInstance: IStorageProvider | null = null;
  private static aiInstance: IAIProvider | null = null;
  private static verificationInstance: IAIVerificationProvider | null = null;
  private static governanceInstance: IGovernanceAIProvider | null = null;
  private static simulationInstance: ISimulationAIProvider | null = null;
  private static geographyInstance: IGeographyProvider | null = null;
  private static populationInstance: IPopulationProvider | null = null;
  private static facilityInstance: IFacilityProvider | null = null;
  private static indicatorInstance: IDevelopmentIndicatorProvider | null = null;
  private static investmentInstance: IPublicInvestmentProvider | null = null;
  private static emailInstance: IEmailProvider | null = null;

  public static getEmailProvider(): IEmailProvider {
    if (!this.emailInstance) {
      if (env.DEMO_MODE) {
        if (env.EMAIL_PROVIDER === 'smtp') {
          this.emailInstance = new SmtpEmailProvider();
        } else {
          this.emailInstance = new MockEmailProvider();
        }
      } else {
        if (env.EMAIL_PROVIDER === 'smtp') {
          this.emailInstance = new SmtpEmailProvider();
        } else {
          throw new AppError({
            statusCode: 500,
            code: ERROR_CODES.INTERNAL_ERROR,
            message: `[ProviderContainer] Unsupported EMAIL_PROVIDER in REAL_MODE: '${env.EMAIL_PROVIDER}'. Must be 'smtp'. Mock email provider is strictly prohibited when DEMO_MODE=false.`
          });
        }
      }
    }
    return this.emailInstance;
  }

  public static getDatabaseProvider(): IDatabaseProvider {
    if (!this.dbInstance) {
      if (env.DEMO_MODE) {
        this.dbInstance = new MockDatabaseProvider();
      } else {
        if (env.DATABASE_PROVIDER === 'postgres') {
          this.dbInstance = new PostgresDatabaseProvider();
        } else if (env.DATABASE_PROVIDER === 'firestore') {
          this.dbInstance = new FirestoreDatabaseProvider();
        } else {
          throw new AppError({
            statusCode: 500,
            code: ERROR_CODES.INTERNAL_ERROR,
            message: `[ProviderContainer] Unsupported DATABASE_PROVIDER in REAL_MODE: '${env.DATABASE_PROVIDER}'. Must be 'postgres' or 'firestore'. Mock database is strictly prohibited when DEMO_MODE=false.`
          });
        }
      }
    }
    return this.dbInstance;
  }

  public static getAuthProvider(): IAuthProvider {
    if (!this.authInstance) {
      if (env.AUTH_PROVIDER === 'supabase') {
        this.authInstance = new SupabaseAuthProvider();
      } else if (env.AUTH_PROVIDER === 'firebase') {
        this.authInstance = new FirebaseAuthProvider();
      } else {
        throw new AppError({
          statusCode: 500,
          code: ERROR_CODES.INTERNAL_ERROR,
          message: `[ProviderContainer] Unsupported AUTH_PROVIDER: '${env.AUTH_PROVIDER}'. Must be 'supabase' or 'firebase'.`
        });
      }
    }
    return this.authInstance;
  }

  public static setAuthProvider(provider: IAuthProvider | null): void {
    this.authInstance = provider;
  }

  public static getStorageProvider(): IStorageProvider {
    if (!this.storageInstance) {
      if (env.DEMO_MODE) {
        this.storageInstance = new LocalStorageProvider();
      } else {
        if (env.STORAGE_PROVIDER === 'r2') {
          this.storageInstance = new R2StorageProvider();
        } else if (env.STORAGE_PROVIDER === 'gcs') {
          this.storageInstance = new GCSStorageProvider();
        } else {
          throw new AppError({
            statusCode: 500,
            code: ERROR_CODES.INTERNAL_ERROR,
            message: `[ProviderContainer] Unsupported STORAGE_PROVIDER in REAL_MODE: '${env.STORAGE_PROVIDER}'. Must be 'r2' or 'gcs'. Local/mock storage is strictly prohibited when DEMO_MODE=false.`
          });
        }
      }
    }
    return this.storageInstance;
  }

  public static getAIProvider(): IAIProvider {
    if (!this.aiInstance) {
      if (env.DEMO_MODE) {
        this.aiInstance = new MockAIProvider();
      } else {
        if (env.AI_PROVIDER === 'openai') {
          this.aiInstance = new OpenAIProvider();
        } else if (env.AI_PROVIDER === 'gemini') {
          this.aiInstance = new GeminiAIProvider();
        } else {
          throw new AppError({
            statusCode: 500,
            code: ERROR_CODES.INTERNAL_ERROR,
            message: `[ProviderContainer] Unsupported AI_PROVIDER in REAL_MODE: '${env.AI_PROVIDER}'. Must be 'openai' or 'gemini'. Mock AI is strictly prohibited when DEMO_MODE=false.`
          });
        }
      }
    }
    return this.aiInstance;
  }

  public static getVerificationProvider(): IAIVerificationProvider {
    if (!this.verificationInstance) {
      if (env.DEMO_MODE) {
        this.verificationInstance = new MockVerificationProvider();
      } else {
        if (env.AI_PROVIDER === 'openai') {
          if (this.aiInstance instanceof OpenAIProvider) {
            this.verificationInstance = this.aiInstance;
          } else {
            this.verificationInstance = new OpenAIProvider();
          }
        } else if (env.AI_PROVIDER === 'gemini') {
          this.verificationInstance = new GeminiVerificationProvider();
        } else {
          throw new AppError({
            statusCode: 500,
            code: ERROR_CODES.INTERNAL_ERROR,
            message: `[ProviderContainer] Unsupported AI_PROVIDER for verification in REAL_MODE: '${env.AI_PROVIDER}'. Must be 'openai' or 'gemini'. Mock verification is strictly prohibited when DEMO_MODE=false.`
          });
        }
      }
    }
    return this.verificationInstance;
  }

  public static getGovernanceProvider(): IGovernanceAIProvider {
    if (!this.governanceInstance) {
      if (env.DEMO_MODE) {
        this.governanceInstance = new MockGovernanceAIProvider();
      } else {
        this.governanceInstance = new GeminiGovernanceAIProvider();
      }
    }
    return this.governanceInstance;
  }

  public static getSimulationProvider(): ISimulationAIProvider {
    if (!this.simulationInstance) {
      if (env.DEMO_MODE) {
        this.simulationInstance = new MockSimulationAIProvider();
      } else {
        this.simulationInstance = new GeminiSimulationAIProvider(env.GEMINI_API_KEY, env.AI_MODEL_GENERAL);
      }
    }
    return this.simulationInstance;
  }

  public static getGeographyProvider(): IGeographyProvider {
    if (!this.geographyInstance) {
      if (env.DEMO_MODE) {
        this.geographyInstance = new MockGeographyProvider();
      } else {
        this.geographyInstance = new StaticGeographyProvider();
      }
    }
    return this.geographyInstance;
  }

  public static getPopulationProvider(): IPopulationProvider {
    if (!this.populationInstance) {
      if (env.DEMO_MODE) {
        this.populationInstance = new MockPopulationProvider();
      } else {
        this.populationInstance = new StaticPopulationProvider();
      }
    }
    return this.populationInstance;
  }

  public static getFacilityProvider(): IFacilityProvider {
    if (!this.facilityInstance) {
      if (env.DEMO_MODE) {
        this.facilityInstance = new MockFacilityProvider();
      } else {
        this.facilityInstance = new StaticFacilityProvider();
      }
    }
    return this.facilityInstance;
  }

  public static getDevelopmentIndicatorProvider(): IDevelopmentIndicatorProvider {
    if (!this.indicatorInstance) {
      if (env.DEMO_MODE) {
        this.indicatorInstance = new MockDevelopmentIndicatorProvider();
      } else {
        this.indicatorInstance = new StaticDevelopmentIndicatorProvider(
          this.getPopulationProvider(),
          this.getGeographyProvider(),
          this.getFacilityProvider(),
          this.getDatabaseProvider(),
          { isDemo: false }
        );
      }
    }
    return this.indicatorInstance;
  }

  public static getPublicInvestmentProvider(): IPublicInvestmentProvider {
    if (!this.investmentInstance) {
      if (env.DEMO_MODE) {
        this.investmentInstance = new MockPublicInvestmentProvider();
      } else {
        this.investmentInstance = new StaticPublicInvestmentProvider(undefined, undefined, { isDemo: false });
      }
    }
    return this.investmentInstance;
  }

  // Testing helper to reset or inject test providers
  public static setDatabaseProvider(provider: IDatabaseProvider | null) {
    this.dbInstance = provider;
  }

  public static setStorageProvider(provider: IStorageProvider | null) {
    this.storageInstance = provider;
  }

  public static setAIProvider(provider: IAIProvider | null) {
    this.aiInstance = provider;
  }

  public static setVerificationProvider(provider: IAIVerificationProvider | null) {
    this.verificationInstance = provider;
  }

  public static setGovernanceProvider(provider: IGovernanceAIProvider | null) {
    this.governanceInstance = provider;
  }

  public static setSimulationProvider(provider: ISimulationAIProvider | null) {
    this.simulationInstance = provider;
  }

  public static setGeographyProvider(provider: IGeographyProvider | null) {
    this.geographyInstance = provider;
  }

  public static setPopulationProvider(provider: IPopulationProvider | null) {
    this.populationInstance = provider;
  }

  public static setFacilityProvider(provider: IFacilityProvider | null) {
    this.facilityInstance = provider;
  }

  public static setDevelopmentIndicatorProvider(provider: IDevelopmentIndicatorProvider | null) {
    this.indicatorInstance = provider;
  }

  public static setPublicInvestmentProvider(provider: IPublicInvestmentProvider | null) {
    this.investmentInstance = provider;
  }

  public static setEmailProvider(provider: IEmailProvider | null) {
    this.emailInstance = provider;
  }

  public static resetToGoldenDemo(): void {
    if (!env.DEMO_MODE) {
      throw new AppError({
        statusCode: 403,
        code: ERROR_CODES.FORBIDDEN,
        message: 'Demo reset is strictly disabled when DEMO_MODE is false (REAL_MODE active). Firestore data is protected.'
      });
    }

    const db = this.getDatabaseProvider();
    if (db instanceof MockDatabaseProvider) {
      db.resetToGoldenDemo();
    }
    if (this.simulationInstance instanceof MockSimulationAIProvider) {
      this.simulationInstance.simulateFailure(false);
      this.simulationInstance.simulateTimeout(false);
    }
  }

  public static resetAllProviders() {
    this.dbInstance = null;
    this.authInstance = null;
    this.storageInstance = null;
    this.aiInstance = null;
    this.verificationInstance = null;
    this.governanceInstance = null;
    this.simulationInstance = null;
    this.geographyInstance = null;
    this.populationInstance = null;
    this.facilityInstance = null;
    this.indicatorInstance = null;
    this.investmentInstance = null;
    this.emailInstance = null;
  }
}

export const getDatabaseProvider = () => ProviderContainer.getDatabaseProvider();
export const getAuthProvider = () => ProviderContainer.getAuthProvider();
export const getStorageProvider = () => ProviderContainer.getStorageProvider();
export const getAIProvider = () => ProviderContainer.getAIProvider();
export const getVerificationProvider = () => ProviderContainer.getVerificationProvider();
export const getGovernanceProvider = () => ProviderContainer.getGovernanceProvider();
export const getSimulationProvider = () => ProviderContainer.getSimulationProvider();
export const getGeographyProvider = () => ProviderContainer.getGeographyProvider();
export const getPopulationProvider = () => ProviderContainer.getPopulationProvider();
export const getFacilityProvider = () => ProviderContainer.getFacilityProvider();
export const getDevelopmentIndicatorProvider = () => ProviderContainer.getDevelopmentIndicatorProvider();
export const getPublicInvestmentProvider = () => ProviderContainer.getPublicInvestmentProvider();
export const getEmailProvider = () => ProviderContainer.getEmailProvider();

export { ProviderContainer };
export * from './database/database.interface';
export * from './storage/storage.interface';
export * from './auth/auth.interface';
export * from './email/email.interface';
export { MockEmailProvider } from './email/mock.email';
export { SmtpEmailProvider } from './email/smtp.email';
export * from './ai/ai.interface';
export * from './ai/verification.interface';
export * from './ai/governance.interface';
export * from './ai/simulation.interface';
export * from './reference/reference.interface';
export { MockDatabaseProvider } from './database/mock.database';
export { FirestoreDatabaseProvider } from './database/firestore.provider';
export { LocalStorageProvider } from './storage/local.storage';
export { GCSStorageProvider } from './storage/gcs.storage';
export { MockAIProvider } from './ai/mock.ai';
export { GeminiAIProvider } from './ai/gemini.provider';
export { MockVerificationProvider } from './ai/mock.verification';
export { GeminiVerificationProvider } from './ai/gemini.verification';
export { MockGovernanceAIProvider } from './ai/mock.governance';
export { GeminiGovernanceAIProvider } from './ai/gemini.governance';
export { MockSimulationAIProvider } from './ai/mock.simulation';
export { GeminiSimulationAIProvider } from './ai/gemini.simulation';
export {
  MockGeographyProvider,
  MockPopulationProvider,
  MockFacilityProvider,
  MockDevelopmentIndicatorProvider,
  MockPublicInvestmentProvider
} from './reference/mock-reference.providers';
export { StaticGeographyProvider } from './reference/static-geography.provider';
export { StaticPopulationProvider } from './reference/static-population.provider';
export { StaticFacilityProvider } from './reference/static-facility.provider';
export { StaticDevelopmentIndicatorProvider } from './reference/static-development-indicator.provider';
export { StaticPublicInvestmentProvider } from './reference/static-public-investment.provider';

// Target Non-Google Providers (Phase 15B Scaffolding)
export { PostgresDatabaseProvider } from './database/postgres.provider';
export { R2StorageProvider } from './storage/r2.storage';
export { OpenAIProvider } from './ai/openai.provider';
export { SupabaseAuthProvider } from './auth/supabase.auth.provider';
export { FirebaseAuthProvider } from './auth/firebase.auth.provider';


