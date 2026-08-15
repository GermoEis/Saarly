import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

type NotificationRow = {
  id: string;
  user_id: string;
  list_id?: string | null;
  title: string;
  body: string;
};

type WebhookPayload = {
  record?: { id?: string };
};

Deno.serve(async (request) => {
  try {
    const payload = await request.json() as WebhookPayload;
    const notificationId = payload.record?.id;
    if (!notificationId) return Response.json({ error: 'notification_id_required' }, { status: 400 });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );
    const { data: notification, error: notificationError } = await supabase
      .from('notifications')
      .select('id,user_id,list_id,title,body')
      .eq('id', notificationId)
      .single<NotificationRow>();
    if (notificationError || !notification) return Response.json({ error: 'notification_not_found' }, { status: 404 });

    const publicKey = Deno.env.get('WEB_PUSH_VAPID_PUBLIC_KEY');
    const privateKey = Deno.env.get('WEB_PUSH_VAPID_PRIVATE_KEY');
    if (!publicKey || !privateKey) return Response.json({ error: 'vapid_not_configured' }, { status: 500 });
    webpush.setVapidDetails('mailto:notifications@saarly.pages.dev', publicKey, privateKey);

    const { data: tokens, error: tokenError } = await supabase
      .from('push_tokens')
      .select('id,token')
      .eq('user_id', notification.user_id)
      .eq('platform', 'web');
    if (tokenError) throw tokenError;

    const expiredIds: string[] = [];
    const message = JSON.stringify({
      title: notification.title,
      body: notification.body,
      url: notification.list_id ? `/list/${notification.list_id}` : '/notifications',
      tag: `saarly-${notification.id}`,
    });
    const results = await Promise.allSettled((tokens ?? []).map(async (entry) => {
      try {
        await webpush.sendNotification(JSON.parse(entry.token), message);
      } catch (reason) {
        const statusCode = (reason as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) expiredIds.push(entry.id);
        else throw reason;
      }
    }));

    if (expiredIds.length) await supabase.from('push_tokens').delete().in('id', expiredIds);
    return Response.json({ sent: results.filter((result) => result.status === 'fulfilled').length, expired: expiredIds.length });
  } catch (reason) {
    console.error(reason);
    return Response.json({ error: reason instanceof Error ? reason.message : 'push_failed' }, { status: 500 });
  }
});
