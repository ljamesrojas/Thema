// The three preview templates (SPEC → Preview): Landing, Dashboard, Settings form. Built only
// from ./ui and the frame's variables; layouts respond to the frame's width (container queries),
// so the mobile frame shows the mobile layout whatever the window size.
import { useId } from "react";
import {
  Badge,
  Button,
  Card,
  CardTitle,
  Checkbox,
  Input,
  Label,
  Muted,
  Select,
  Separator,
  Switch,
  Table,
  Td,
  Textarea,
  Th,
} from "./ui";
import { BODY_FONT, HEADING_FONT, type } from "./variables";

/** The system's layout tokens: content width, side gutter, section rhythm. */
const section = {
  paddingBlock: "var(--spacing-section)",
  paddingInline: "var(--spacing-gutter)",
} as const;
const inner = "mx-auto flex w-full flex-col";
const innerStyle = { maxWidth: "var(--container-max)" } as const;

function Brand() {
  return (
    <span className="flex items-center gap-2" style={{ ...type("base"), fontWeight: 600 }}>
      <span
        aria-hidden="true"
        className="inline-block size-4 rounded-(--radius-sm) bg-(--primary)"
      />
      Acme
    </span>
  );
}

export function LandingTemplate() {
  return (
    <div style={{ fontFamily: BODY_FONT }}>
      <header
        className="border-b border-(--border)"
        style={{ paddingInline: "var(--spacing-gutter)" }}
      >
        <nav
          aria-label="Acme"
          className={`${inner} flex-row items-center justify-between gap-4 py-3`}
          style={innerStyle}
        >
          <Brand />
          <span className="hidden gap-5 text-(--muted-foreground) @2xl:flex" style={type("sm")}>
            <span>Product</span>
            <span>Pricing</span>
            <span>Customers</span>
          </span>
          <span className="flex gap-2">
            <Button variant="ghost">Sign in</Button>
            <Button>Get started</Button>
          </span>
        </nav>
      </header>

      <section style={section}>
        <div className={`${inner} items-start gap-5`} style={innerStyle}>
          <Badge variant="secondary">New · Release 4.0</Badge>
          <h1 className="m-0 max-w-[16ch]" style={{ ...type("4xl"), fontFamily: HEADING_FONT }}>
            Calm software for busy teams
          </h1>
          <p className="m-0 max-w-[52ch] text-(--muted-foreground)" style={type("lg")}>
            Plan, track and ship in one quiet place. Every color, font and radius on this page comes
            from your blended system.
          </p>
          <span className="flex flex-wrap gap-3">
            <Button>Start free trial</Button>
            <Button variant="outline">Book a demo</Button>
          </span>
        </div>
      </section>

      <section className="bg-(--muted)" style={section}>
        <div className={`${inner} gap-6`} style={innerStyle}>
          <h2 className="m-0" style={{ ...type("2xl"), fontFamily: HEADING_FONT }}>
            Everything in one place
          </h2>
          <div className="grid gap-4 @2xl:grid-cols-3">
            {[
              ["Roadmaps", "See the quarter at a glance, from idea to shipped."],
              ["Cycles", "A two-week rhythm, built in, with nothing to configure."],
              ["Insights", "Know what shipped, what slipped, and why."],
            ].map(([title, text]) => (
              <Card key={title}>
                <CardTitle>{title}</CardTitle>
                <Muted>{text}</Muted>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section style={section}>
        <div className={`${inner} gap-6`} style={innerStyle}>
          <h2 className="m-0" style={{ ...type("2xl"), fontFamily: HEADING_FONT }}>
            Simple pricing
          </h2>
          <div className="grid gap-4 @2xl:grid-cols-2">
            {[
              ["Starter", "$0", "For a small team trying things out.", "outline"],
              ["Team", "$12", "For teams that ship every week.", "default"],
            ].map(([name, price, text, variant]) => (
              <Card
                key={name}
                className={variant === "default" ? "border-2 border-(--primary)" : ""}
              >
                <span className="flex items-center justify-between">
                  <CardTitle>{name}</CardTitle>
                  {variant === "default" && <Badge>Popular</Badge>}
                </span>
                <span style={{ ...type("3xl"), fontFamily: HEADING_FONT }}>
                  {price}
                  <span className="text-(--muted-foreground)" style={type("sm")}>
                    {" "}
                    / month
                  </span>
                </span>
                <Muted>{text}</Muted>
                <Button variant={variant === "default" ? "default" : "outline"}>
                  Choose {name}
                </Button>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <footer
        className="border-t border-(--border) py-6"
        style={{ paddingInline: "var(--spacing-gutter)" }}
      >
        <div className={`${inner} flex-row flex-wrap justify-between gap-3`} style={innerStyle}>
          <Muted>© 2026 Acme</Muted>
          <Muted>Privacy · Terms</Muted>
        </div>
      </footer>
    </div>
  );
}

/** One series (deploys per day), so one color: chart-1. */
export const WEEKLY_BARS = [62, 80, 45, 90, 70, 55, 84] as const;

/** Five series, one per chart color, as a single stacked bar with a legend. */
export const CHANNELS = [
  ["Search", 38],
  ["Direct", 24],
  ["Social", 17],
  ["Email", 13],
  ["Referral", 8],
] as const;

export function DashboardTemplate() {
  return (
    <div className="flex flex-col @3xl:flex-row" style={{ fontFamily: BODY_FONT }}>
      <aside className="flex flex-col gap-1 border-b border-(--sidebar-border) bg-(--sidebar) p-4 text-(--sidebar-foreground) @3xl:w-56 @3xl:border-r @3xl:border-b-0">
        <span className="px-2 pb-3">
          <Brand />
        </span>
        <nav aria-label="Dashboard" className="flex flex-wrap gap-1 @3xl:flex-col">
          {["Overview", "Projects", "Team", "Billing"].map((item, i) => (
            <span
              key={item}
              className={
                i === 0
                  ? "rounded-(--radius) bg-(--sidebar-primary) px-3 py-2 text-(--sidebar-primary-foreground)"
                  : "rounded-(--radius) px-3 py-2"
              }
              style={type("sm")}
            >
              {item}
            </span>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="m-0" style={{ ...type("2xl"), fontFamily: HEADING_FONT }}>
            Overview
          </h1>
          <Button>New project</Button>
        </div>

        <div className="grid grid-cols-2 gap-4 @3xl:grid-cols-4">
          {[
            ["Revenue", "$48.2k", "+12%"],
            ["Active users", "2,431", "+4%"],
            ["Open issues", "38", "−6"],
            ["Uptime", "99.98%", "30 days"],
          ].map(([label, value, delta]) => (
            <Card key={label} className="gap-2 p-4">
              <Muted>{label}</Muted>
              <span style={{ ...type("2xl"), fontFamily: HEADING_FONT }}>{value}</span>
              <Badge variant="secondary" className="self-start">
                {delta}
              </Badge>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 @3xl:grid-cols-[3fr_2fr]">
          <Card>
            <CardTitle as="h2">Weekly activity</CardTitle>
            <div aria-hidden="true" className="flex h-32 items-end gap-2">
              {WEEKLY_BARS.map((height, i) => (
                <span
                  key={i}
                  data-testid="weekly-bar"
                  className="flex-1 rounded-t-(--radius-sm) bg-(--chart-1)"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
            <Muted>Deploys per day, last seven days.</Muted>
          </Card>

          <Card>
            <CardTitle as="h2">Traffic by channel</CardTitle>
            <div
              aria-hidden="true"
              className="flex h-3 gap-0.5 overflow-hidden rounded-(--radius-sm)"
            >
              {CHANNELS.map(([channel, share], i) => (
                <span
                  key={channel}
                  data-testid="channel-segment"
                  style={{ width: `${share}%`, background: `var(--chart-${i + 1})` }}
                />
              ))}
            </div>
            <ul className="m-0 flex list-none flex-col gap-2 p-0" style={type("sm")}>
              {CHANNELS.map(([channel, share], i) => (
                <li key={channel} className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="size-2.5 flex-none rounded-full"
                    style={{ background: `var(--chart-${i + 1})` }}
                  />
                  <span className="flex-1">{channel}</span>
                  <span className="text-(--muted-foreground)">{share}%</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Card className="gap-2">
          <CardTitle as="h2">Recent orders</CardTitle>
          <Table label="Recent orders">
            <thead>
              <tr>
                <Th>Customer</Th>
                <Th>Plan</Th>
                <Th>Status</Th>
                <Th>Amount</Th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Northwind", "Team", "Paid", "$120"],
                ["Globex", "Starter", "Pending", "$0"],
                ["Initech", "Team", "Paid", "$240"],
              ].map(([customer, plan, status, amount]) => (
                <tr key={customer}>
                  <Td>{customer}</Td>
                  <Td>{plan}</Td>
                  <Td>
                    <Badge variant={status === "Paid" ? "default" : "outline"}>{status}</Badge>
                  </Td>
                  <Td>{amount}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  );
}

export function SettingsTemplate() {
  const id = useId();
  return (
    <div className="flex flex-col gap-5 p-5 @2xl:p-8" style={{ fontFamily: BODY_FONT }}>
      <div className="flex flex-col gap-1">
        <h1 className="m-0" style={{ ...type("2xl"), fontFamily: HEADING_FONT }}>
          Settings
        </h1>
        <Muted>Manage your profile and how Acme keeps in touch.</Muted>
      </div>

      <Card>
        <CardTitle as="h2">Profile</CardTitle>
        <div className="grid gap-4 @2xl:grid-cols-2">
          <span className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-name`}>Name</Label>
            <Input id={`${id}-name`} defaultValue="Ada Lovelace" />
          </span>
          <span className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-email`}>Email</Label>
            <Input id={`${id}-email`} type="email" defaultValue="ada@acme.example" />
          </span>
          <span className="flex flex-col gap-1.5">
            <Label htmlFor={`${id}-role`}>Role</Label>
            <Select id={`${id}-role`} defaultValue="admin">
              <option value="admin">Admin</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </Select>
          </span>
          <span className="flex flex-col gap-1.5 @2xl:col-span-2">
            <Label htmlFor={`${id}-bio`}>Bio</Label>
            <Textarea id={`${id}-bio`} defaultValue="Writes the first programs." />
          </span>
        </div>
      </Card>

      <Card>
        <CardTitle as="h2">Notifications</CardTitle>
        {[
          ["Product updates", true],
          ["Weekly summary", true],
          ["Security alerts", false],
        ].map(([label, on], i) => (
          <span key={String(label)} className="flex items-center justify-between gap-4">
            <Label htmlFor={`${id}-switch-${i}`}>{label}</Label>
            <Switch id={`${id}-switch-${i}`} defaultChecked={Boolean(on)} />
          </span>
        ))}
        <Separator />
        {["Email", "Push"].map((channel, i) => (
          <span key={channel} className="flex items-center gap-2">
            <Checkbox id={`${id}-check-${i}`} defaultChecked={i === 0} />
            <Label htmlFor={`${id}-check-${i}`}>{channel}</Label>
          </span>
        ))}
        <span className="flex flex-wrap justify-end gap-2">
          <Button variant="outline">Cancel</Button>
          <Button>Save changes</Button>
        </span>
      </Card>

      <Card className="border-(--destructive)">
        <CardTitle as="h2">Danger zone</CardTitle>
        <Muted>Deleting your workspace removes every project. This can&apos;t be undone.</Muted>
        <Button variant="destructive" className="self-start">
          Delete workspace
        </Button>
      </Card>
    </div>
  );
}

export const TEMPLATES = {
  landing: { label: "Landing", Template: LandingTemplate },
  dashboard: { label: "Dashboard", Template: DashboardTemplate },
  settings: { label: "Settings form", Template: SettingsTemplate },
} as const;
export type TemplateId = keyof typeof TEMPLATES;
