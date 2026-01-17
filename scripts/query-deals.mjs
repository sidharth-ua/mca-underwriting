import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const deals = await prisma.deal.findMany({ take: 5, select: { id: true, merchantName: true, status: true } });
console.log(JSON.stringify(deals, null, 2));
await prisma.$disconnect();
