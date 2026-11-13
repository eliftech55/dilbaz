import { auth } from './config';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function getFriendlyAuthError(err: unknown): { message: string; needsEmailProviderSetup?: boolean } {
  const code = (err as { code?: string })?.code || '';
  const msg = (err as { message?: string })?.message || '';

  if (code === 'auth/operation-not-allowed') {
    return {
      needsEmailProviderSetup: true,
      message:
        'Firebase projesinde "E-posta/Şifre (Email/Password)" giriş yöntemi henüz etkinleştirilmemiş. Google ile hemen giriş yapabilir veya Firebase Console > Authentication > Sign-in method bölümünden E-posta/Şifre seçeneğini açabilirsiniz.'
    };
  }
  if (code === 'auth/email-already-in-use') {
    return { message: 'Bu e-posta adresiyle zaten bir hesap kayıtlı. Giriş yapmayı deneyin.' };
  }
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return { message: 'E-posta adresi veya şifre hatalı. Google ile kayıt olduysanız önce Google ile girip şifre tanımlayabilirsiniz.' };
  }
  if (code === 'auth/weak-password') {
    return { message: 'Şifreniz en az 6 karakter olmalıdır.' };
  }
  if (code === 'auth/invalid-email') {
    return { message: 'Lütfen geçerli bir e-posta adresi girin.' };
  }
  if (code === 'auth/popup-blocked') {
    return {
      message:
        'Tarayıcı veya telefon açılır Google giriş penceresini (popup) engelledi. Adres çubuğundan açılır pencerelere izin verip tekrar deneyin veya aşağıdaki "E-posta ile Giriş Yap" bölümünü kullanın.'
    };
  }
  if (code === 'auth/cancelled-popup-request') {
    return { message: 'Önceki giriş penceresi iptal edildi. Lütfen tekrar tıklayın.' };
  }
  if (code === 'auth/unauthorized-domain') {
    const host = typeof window !== 'undefined' ? window.location.hostname : '';
    return {
      message: `Bu alan adı (${host}) Firebase Authentication yetkili alan adları listesinde ekli değil. Firebase Console > Authentication > Settings > Authorized domains bölümüne ekleyin.`
    };
  }
  if (code === 'auth/network-request-failed') {
    return { message: 'İnternet bağlantısı kurulamadı. Bağlantınızı kontrol edip tekrar deneyin.' };
  }
  if (code === 'auth/popup-closed-by-user') {
    return { message: 'Google giriş penceresi kapatıldı. Tekrar deneyebilirsiniz.' };
  }
  if (code === 'auth/provider-already-linked') {
    return { message: 'Bu hesapta zaten şifre ile giriş aktif.' };
  }
  if (code === 'auth/requires-recent-login') {
    return { message: 'Güvenlik nedeniyle lütfen yeniden giriş yapıp tekrar deneyin.' };
  }
  return { message: msg || 'Kimlik doğrulama sırasında bir hata oluştu.' };
}
