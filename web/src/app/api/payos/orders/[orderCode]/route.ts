import { currentAccount } from '@/lib/currentUser';
import { getPayosCredentials } from '@/lib/payos/config';
import { createPayosOrderHandlers } from '@/lib/payos/orderHandlers';
import { deleteOrder, getOrder, markOrder } from '@/lib/payos/orders';
import { addGrant, listGrants, redeemCoupon } from '@/lib/store/account';
import { PayOS } from '@payos/node';

const getPayosClient = () => {
  const { clientId, apiKey, checksumKey } = getPayosCredentials();
  if (!clientId || !apiKey || !checksumKey) return null;
  return new PayOS({ clientId, apiKey, checksumKey });
};

const handlers = createPayosOrderHandlers({
  currentAccount,
  getOrder,
  markOrder,
  deleteOrder,
  listGrants,
  addGrant,
  redeemCoupon,
  getPayosClient,
});

export const GET = handlers.GET;
export const POST = handlers.POST;
export const PATCH = handlers.PATCH;
