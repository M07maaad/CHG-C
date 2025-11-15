const { createClient } = require('@supabase/supabase-js');
const webPush = require('web-push');

// قراءة المفاتيح من Vercel Environment Variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

// إعداد web-push
webPush.setVapidDetails(
  'mailto:your-email@example.com', // يمكنك تغييره لإيميلك
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// إعداد Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

console.log('Notification Sender Function Initialized (on Vercel Node.js).');

// Vercel يتطلب هذا الشكل من الـ handler
module.exports = async (req, res) => {
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
      return res.status(200).json({ message: "No notifications to send." });
    }

    console.log(`Found ${notifications.length} notifications to send.`);
    const processingPromises = [];

    // 2. معالجة كل إشعار
    for (const notif of notifications) {
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

          const subscription = subData.subscription_data;
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
          
          if (pushError.statusCode === 410) {
            console.warn(`Subscription for user ${notif.user_id} is expired. Deleting subscription.`);
            await supabase.from('push_subscriptions').delete().eq('user_id', notif.user_id);
          }
          
          // امسح الإشعار من الطابور حتى لو فشل
          await supabase.from('notification_queue').delete().eq('id', notif.id);
        }
      })();
      
      processingPromises.push(promise);
    }

    await Promise.all(processingPromises);

    return res.status(200).json({ message: `Processed ${notifications.length} notifications.` });

  } catch (err) {
    console.error('General error in function:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
