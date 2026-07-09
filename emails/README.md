# قوالب البريد — بدِّل

قوالب HTML عربية جاهزة (RTL + هوية بدِّل البصرية).

## القوالب المتاحة

| الملف | الاستخدام | المتغيرات |
|------|----------|-----------|
| `welcome.html` | ترحيب بعد تفعيل الحساب | `{{name}}`, `{{app_url}}` |
| `auth-confirm.html` | تأكيد البريد بعد التسجيل | `{{ .ConfirmationURL }}` |
| `reset-password.html` | إعادة تعيين كلمة المرور | `{{ .ConfirmationURL }}` |

## طريقة الربط

### 1) قوالب المصادقة (auth-confirm / reset-password)
تُرفع من **Lovable Cloud → Users → Email Templates** (تستخدم متغيرات Supabase مثل `{{ .ConfirmationURL }}`).

### 2) قالب الترحيب (welcome.html)
يُرسل عبر **Lovable Emails** أو مزود خارجي (Resend / Brevo).
مثال إرسال من Server Function:

```ts
// src/lib/emails.functions.ts
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const sendWelcomeEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const html = welcomeTemplate
      .replace("{{name}}", context.claims.email ?? "صديقنا")
      .replace(/\{\{app_url\}\}/g, "https://badelbarter.lovable.app");
    // ... send via Resend / Brevo gateway
  });
```

يمكن استدعاؤه بعد أول تسجيل دخول للمستخدم الجديد.
