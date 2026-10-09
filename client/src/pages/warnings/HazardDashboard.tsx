import React from 'react';
import { AlertCircle, CheckCircle2, ShieldAlert, ArrowRight, MapPin, Calendar, Waves, Flame, Mountain } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { IHazard } from '../../types';

interface HazardDashboardProps {
  hazards: IHazard[];
  onSelectHazardForWarning: (hazard: IHazard) => void;
}

export const HazardDashboard: React.FC<HazardDashboardProps> = ({
  hazards,
  onSelectHazardForWarning,
}) => {
  const getDisasterIcon = (type: string) => {
    switch (type.toUpperCase()) {
      case 'FLOOD':
        return <Waves className="w-5 h-5 text-blue-600" />;
      case 'LANDSLIDE':
        return <Mountain className="w-5 h-5 text-amber-700" />;
      case 'FIRE':
        return <Flame className="w-5 h-5 text-red-600" />;
      default:
        return <AlertCircle className="w-5 h-5 text-purple-600" />;
    }
  };

  const getSeverityBadgeVariant = (severity: string) => {
    switch (severity.toUpperCase()) {
      case 'CRITICAL':
        return 'danger' as const;
      case 'HIGH':
        return 'warning' as const;
      case 'MODERATE':
        return 'info' as const;
      default:
        return 'default' as const;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-6 rounded-2xl shadow-md border border-indigo-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-1.5 bg-blue-500/20 rounded-lg text-blue-300">
                <ShieldAlert className="w-5 h-5" />
              </span>
              <span className="text-xs font-semibold tracking-wider text-blue-300 uppercase">
                DMC Duty Officer Command Console
              </span>
            </div>
            <h2 className="text-2xl font-bold">Hazard Assessment & Verified Incident Feed</h2>
            <p className="text-indigo-200 text-sm mt-1 max-w-2xl">
              Monitor verified field intelligence from hydrometric sensors, geological bureaus, and field observers. Select any verified hazard to formulate targeted public warnings.
            </p>
          </div>
          <div className="flex items-center gap-3 bg-white/10 px-4 py-3 rounded-xl border border-white/10">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            <div>
              <p className="text-xs text-indigo-200 font-medium">Ready For Warnings</p>
              <p className="text-xl font-bold">{hazards.length} Verified Hazards</p>
            </div>
          </div>
        </div>
      </div>

      {/* Verified Hazards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {hazards.map((hazard) => (
          <Card
            key={hazard._id || hazard.id}
            className="hover:shadow-md transition-shadow border-gray-200 flex flex-col justify-between"
          >
            <div>
              <CardHeader className="pb-3 border-b border-gray-100 bg-gray-50/50">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="p-2 bg-white rounded-lg shadow-2xs border border-gray-200">
                      {getDisasterIcon(hazard.disasterType)}
                    </span>
                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        {hazard.disasterType}
                      </span>
                      <CardTitle className="text-base line-clamp-1">{hazard.title}</CardTitle>
                    </div>
                  </div>
                  <Badge variant={getSeverityBadgeVariant(hazard.severity)}>
                    {hazard.severity}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="pt-4 space-y-3">
                <p className="text-sm text-gray-600 line-clamp-3 leading-relaxed">
                  {hazard.description}
                </p>

                <div className="space-y-1.5 text-xs text-gray-500 pt-2 border-t border-gray-100">
                  <div className="flex items-center gap-1.5 font-medium text-gray-700">
                    <MapPin className="w-3.5 h-3.5 text-brand-600 flex-shrink-0" />
                    <span>
                      {hazard.location.district}
                      {hazard.location.address ? ` (${hazard.location.address})` : ''}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span>
                      Verified: {hazard.verifiedAt ? new Date(hazard.verifiedAt).toLocaleDateString() : 'Recent'}
                    </span>
                  </div>

                  {hazard.verifiedBy && (
                    <p className="text-[11px] text-gray-400 italic">
                      Officer: {hazard.verifiedBy}
                    </p>
                  )}
                </div>
              </CardContent>
            </div>

            <div className="p-4 pt-0">
              <Button
                variant="primary"
                className="w-full flex items-center justify-center gap-2 text-sm"
                onClick={() => onSelectHazardForWarning(hazard)}
              >
                <span>Assess & Issue Warning</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
