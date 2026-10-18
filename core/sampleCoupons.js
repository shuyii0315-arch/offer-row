// Sample bank-loan coupons used in the demo. Credit limit ¥9,550.
export const CREDIT = 9550;

export const COUPONS = [
  { id: 'if10', type: 'interestFree', title: '10 Days Interest-Free', days: 10, minAmount: 1000, expires: 'Expires Oct 1', expiresOrder: 2, daysLeft: 15 },
  { id: 'if3', type: 'interestFree', title: '3 Days Interest-Free', days: 3, minAmount: 1000, expires: 'Expires Jul 11', expiresOrder: 1, daysLeft: 3 },
  { id: 'rd30', type: 'rateDiscount', title: '30% Off Interest', discount: 0.3, minAmount: 2000, expires: 'Expires Oct 1', expiresOrder: 2, daysLeft: 15 },
  { id: 'rd20', type: 'rateDiscount', title: '20% Off Interest', discount: 0.2, minAmount: 1500, expires: 'Expires Oct 1', expiresOrder: 2, daysLeft: 15 },
];
