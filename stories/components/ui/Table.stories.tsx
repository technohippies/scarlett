import { For } from 'solid-js';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../src/components/ui/table';

const invoices = [
  {
    invoice: "INV001",
    paymentStatus: "Paid",
    totalAmount: "$250.00",
    paymentMethod: "Credit Card",
  },
  {
    invoice: "INV002",
    paymentStatus: "Pending",
    totalAmount: "$150.00",
    paymentMethod: "PayPal",
  },
  {
    invoice: "INV003",
    paymentStatus: "Unpaid",
    totalAmount: "$350.00",
    paymentMethod: "Bank Transfer",
  },
  // Add more invoices if desired for a longer table example
];

export default {
  title: 'Components/UI/Table',
  component: Table, // Main component
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  // argTypes can be added here if needed for table-level controls
  args: {
    // Default args for the Table component itself, if any
  },
};

// Define the story for the Table
export const Default = {
  render: () => ( // No props needed for this basic render
    <div style={{ width: '100%', "max-width": '600px' }}>
      <Table>
        <TableCaption>A list of your recent invoices.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead class="w-[100px] pl-0 pr-2">Invoice</TableHead>
            <TableHead class="px-2">Status</TableHead>
            <TableHead class="px-2">Method</TableHead>
            <TableHead class="text-right pr-0 pl-2">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <For each={invoices}>{(invoice) => (
            <TableRow>
              <TableCell class="font-medium pl-0 pr-2">{invoice.invoice}</TableCell>
              <TableCell class="px-2">{invoice.paymentStatus}</TableCell>
              <TableCell class="px-2">{invoice.paymentMethod}</TableCell>
              <TableCell class="text-right pr-0 pl-2">{invoice.totalAmount}</TableCell>
            </TableRow>
          )}</For>
        </TableBody>
      </Table>
    </div>
  ),
  args: {
    // Args specific to this Default story instance, if any
  },
};
