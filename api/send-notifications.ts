// Vercel Serverless Function: /api/send-notifications.ts
// هذا الكود هو "السيرفر" الذي سيرسل الإشعارات
// (سيعمل على Vercel وليس Supabase)

import { createClient } from 'npm:@supabase/supabase-js@2';
import webPush from 'npm:web-push';

// تعريف أنواع البيانات لـ TypeScript
interface NotificationQueueEntry {
  id: number;
  user_id: string;
  title: string;
  body: string;
}

interface PushSubscriptionEntry {
  subscription_data: webPush.PushSubscription;
}

// إعداد web-push باستخدام مفاتيح VAPID
// سوف نقرأ هذه المفاتيح من "Environment Variables" في Vercel
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;

webPush.setVapidDetails(
  'mailto:your-email@example.com', // يمكنك تغييره لإيميلك
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

console.log('Notification Sender Function Initialized (on Vercel).');

// Vercel يتطلب هذا الشكل من الـ handler
export default async (req: Request): Promise<Response> => {
  // استخدام مفتاح "Service Role" السري للوصول الكامل لقاعدة البيانات
  // (سنقرأه من Vercel Environment Variables)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! 
  );

  try {
    // 1. جلب كل الإشعارات التي حان وقت إرسالها
    const now = new Date().toISOString();
    const { data: notifications, error: queueError } = await supabase
      .from('notification_queue')
      .select('*')
      .lte('fire_at', now); // جلب أي إشعار معاده الآن أو فات

    if (queueError) throw queueError;

    if (!notifications || notifications.length === 0) {
      console.log('No notifications to send at this time.');
      return new Response(JSON.stringify({ message: "No notifications to send." }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    console.log(`Found ${notifications.length} notifications to send.`);
    const processingPromises: Promise<void>[] = [];

    // 2. معالجة كل إشعار
    for (const notif of notifications as NotificationQueueEntry[]) {
      const promise = (async () => {
        try {
          // 2a. جلب "عنوان" (اشتراك) المستخدم من الجدول الآخر
          const { data: subData, error: subError } = await supabase
            .from('push_subscriptions')
            .select('subscription_data')
            .eq('user_id', notif.user_id)
            .single();

          if (subError || !subData) {
            throw new Error(`No subscription found for user ${notif.user_id}. Deleting notification.`);
          }

          const subscription = (subData as PushSubscriptionEntry).subscription_data;
          const payload = JSON.stringify({
            title: notif.title,
            body: notif.body,
          });

          // 2b. إرسال الإشعار (Push Notification)
          console.log(`Sending notification ${notif.id} to user ${notif.user_id}...`);
          await webPush.sendNotification(subscription, payload);
          
          // 2c. مسح الإشعار من الطابور بعد إرساله بنجاح
          await supabase.from('notification_queue').delete().eq('id', notif.id);
          console.log(`Successfully sent and deleted notification ${notif.id}.`);

        } catch (pushError) {
          console.error(`Failed to process notification ${notif.id} for user ${notif.user_id}:`, pushError.message);
          
          // إذا كان الخطأ (410 Gone)، فهذا يعني أن الاشتراك لم يعد صالحاً
          if (pushError.statusCode === 410) {
            console.warn(`Subscription for user ${notif.user_id} is expired. Deleting subscription.`);
            await supabase.from('push_subscriptions').delete().eq('user_id', notif.user_id);
          }
          
          // امسح الإشعار من الطابور حتى لو فشل (عشان منفضلش نحاول نبعته)
          await supabase.from('notification_queue').delete().eq('id', notif.id);
        }
      })();
      
      processingPromises.push(promise);
    }

    await Promise.all(processingPromises);

    return new Response(JSON.stringify({ message: `Processed ${notifications.length} notifications.` }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    console.error('General error in function:', err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    });
  }
};
