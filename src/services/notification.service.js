import { getMessaging, isFirebaseInitialized } from '../config/firebase-admin.js';

/**
 * Send push notification to topic
 */
export const sendToTopic = async (topic, { title, body, data = {} }) => {
  if (!isFirebaseInitialized()) {
    console.log('⚠️ Firebase not initialized - skipping notification');
    return null;
  }

  try {
    const message = {
      notification: {
        title,
        body,
      },
      data: {
        ...data,
        // Convert all data values to strings (FCM requirement)
        ...Object.keys(data).reduce((acc, key) => {
          acc[key] = String(data[key]);
          return acc;
        }, {}),
      },
      topic,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'stock_recommendations',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    const messaging = getMessaging();
    const response = await messaging.send(message);
    console.log('✅ Notification sent to topic:', topic, '- Response:', response);
    return response;
  } catch (error) {
    console.error('❌ Error sending notification to topic:', error.message);
    throw error;
  }
};

/**
 * Send push notification to specific device token
 */
export const sendToDevice = async (token, { title, body, data = {} }) => {
  if (!isFirebaseInitialized()) {
    console.log('⚠️ Firebase not initialized - skipping notification');
    return null;
  }

  try {
    const message = {
      notification: {
        title,
        body,
      },
      data: {
        ...data,
        // Convert all data values to strings (FCM requirement)
        ...Object.keys(data).reduce((acc, key) => {
          acc[key] = String(data[key]);
          return acc;
        }, {}),
      },
      token,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'stock_recommendations',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    const messaging = getMessaging();
    const response = await messaging.send(message);
    console.log('✅ Notification sent to device:', response);
    return response;
  } catch (error) {
    console.error('❌ Error sending notification to device:', error.message);
    throw error;
  }
};

/**
 * Send notification when new stock is added
 */
export const notifyNewStock = async (stock) => {
  const statusEmoji = {
    entry: '🟢',
    hold: '🟡',
    exit: '🔴',
    exited: '⚫',
  };

  const title = `${statusEmoji[stock.status] || '📈'} New ${stock.status.toUpperCase()} Recommendation`;
  const body = `${stock.symbol} - ${stock.companyName}`;
  const data = {
    type: 'new_stock',
    stockId: stock.id,
    symbol: stock.symbol,
    status: stock.status,
    companyName: stock.companyName,
  };

  try {
    await sendToTopic('stock_recommendations', { title, body, data });
    console.log(`✅ Sent notification for new stock: ${stock.symbol}`);
  } catch (error) {
    console.error(`❌ Failed to send notification for stock: ${stock.symbol}`, error);
  }
};

/**
 * Send notification when stock is updated
 */
export const notifyStockUpdate = async (stock, oldStatus, statusChanged = true) => {
  const statusEmoji = {
    entry: '🟢',
    hold: '🟡',
    exit: '🔴',
    exited: '⚫',
  };

  // Different message based on whether status changed or just data updated
  const title = statusChanged 
    ? `${statusEmoji[stock.status] || '📈'} ${stock.symbol} Status Updated`
    : `📝 ${stock.symbol} Updated`;
  
  const body = statusChanged
    ? `${oldStatus.toUpperCase()} → ${stock.status.toUpperCase()}`
    : `Stock details have been updated`;
  
  const data = {
    type: 'stock_update',
    stockId: stock.id,
    symbol: stock.symbol,
    status: stock.status,
    oldStatus,
    statusChanged: String(statusChanged),
  };

  try {
    await sendToTopic('stock_recommendations', { title, body, data });
    console.log(`✅ Sent update notification for stock: ${stock.symbol}`);
  } catch (error) {
    console.error(`❌ Failed to send update notification for stock: ${stock.symbol}`, error);
  }
};

export default { sendToTopic, sendToDevice, notifyNewStock, notifyStockUpdate };
